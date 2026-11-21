package com.mockza.mockza

import android.app.Activity
import android.app.PendingIntent
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Parcel
import android.provider.Settings
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import org.json.JSONObject
import java.io.File
import java.util.UUID

class MainActivity : FlutterActivity() {
    private val audioSessionChannel = "com.mockza/audio_session"
    private val shareIntentChannelName = "com.mockza.app/share_intent"
    private val mediaPickerChannelName = "com.mockza.app/media_picker"
    private val iranIapChannelName = "ir.sanjia.app/iran_iap"
    private val maxSharedFileBytes = 5L * 1024L * 1024L
    private val iranIapRequestCode = 9417
    private val mediaPickerRequestCode = 9418

    private var activeFocusRequest: AudioFocusRequest? = null
    private var shareChannel: MethodChannel? = null
    private var pendingInitialShare: Map<String, Any?>? = null
    private var pendingIapResult: MethodChannel.Result? = null
    private var pendingIapProductId: String? = null
    private var pendingPickerResult: MethodChannel.Result? = null
    private var pendingPickerMimeType: String = "image/*"
    private var pendingPickerMaxFiles: Int = 4

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        pendingInitialShare = extractSharePayload(intent)
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            audioSessionChannel,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "configureRecordingSession" -> {
                    try {
                        val audioManager =
                            getSystemService(Context.AUDIO_SERVICE) as AudioManager
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            val request = AudioFocusRequest.Builder(
                                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE,
                            ).setAudioAttributes(
                                AudioAttributes.Builder()
                                    .setUsage(AudioAttributes.USAGE_MEDIA)
                                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                                    .build(),
                            ).build()
                            activeFocusRequest = request
                            audioManager.requestAudioFocus(request)
                        } else {
                            @Suppress("DEPRECATION")
                            audioManager.requestAudioFocus(
                                null,
                                AudioManager.STREAM_MUSIC,
                                AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE,
                            )
                        }
                        result.success(null)
                    } catch (e: Exception) {
                        result.error(
                            "AUDIO_SESSION_ERROR",
                            e.message ?: "Failed to configure recording focus",
                            null,
                        )
                    }
                }

                "openAppSettings" -> {
                    try {
                        val intent = Intent(
                            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", packageName, null),
                        ).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        }
                        startActivity(intent)
                        result.success(true)
                    } catch (_: Exception) {
                        result.success(false)
                    }
                }

                else -> result.notImplemented()
            }
        }

        val shareCh = MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            shareIntentChannelName,
        )
        shareCh.setMethodCallHandler { call, result ->
            when (call.method) {
                "consumeInitialShare" -> {
                    val payload = pendingInitialShare
                    pendingInitialShare = null
                    result.success(payload)
                }

                else -> result.notImplemented()
            }
        }
        shareChannel = shareCh

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            mediaPickerChannelName,
        ).setMethodCallHandler { call, result ->
            if (call.method != "pickMediaFiles") {
                result.notImplemented()
                return@setMethodCallHandler
            }
            if (pendingPickerResult != null) {
                result.error("PICKER_BUSY", "Media picker already open.", null)
                return@setMethodCallHandler
            }
            val mime = call.argument<String>("mimeType") ?: "image/*"
            val multiple = call.argument<Boolean>("multiple") == true
            val maxFiles = (call.argument<Int>("maxFiles") ?: 4).coerceIn(1, 4)
            pendingPickerResult = result
            pendingPickerMimeType = mime
            pendingPickerMaxFiles = maxFiles
            try {
                val pickIntent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mime
                    putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple)
                }
                startActivityForResult(pickIntent, mediaPickerRequestCode)
            } catch (e: Exception) {
                pendingPickerResult = null
                result.error("PICKER_ERROR", e.message ?: "Unable to launch media picker", null)
            }
        }

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            iranIapChannelName,
        ).setMethodCallHandler { call, result ->
            if (applicationContext.packageName != "ir.sanjia.app") {
                result.error(
                    "IAP_FLAVOR_DISABLED",
                    "Iran store IAP is only enabled on Sanjia (ir.sanjia.app).",
                    null,
                )
                return@setMethodCallHandler
            }
            val store = call.argument<String>("store")?.lowercase() ?: "bazaar"
            when (call.method) {
                "queryLatestPurchase" -> handleIabQueryLatest(store, result)
                "launchPurchase" -> {
                    val productId = call.argument<String>("productId")?.trim().orEmpty()
                    if (productId.isEmpty()) {
                        result.error("INVALID_SKU", "Product ID is required.", null)
                    } else {
                        handleIabLaunchPurchase(store, productId, result)
                    }
                }

                else -> result.notImplemented()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val payload = extractSharePayload(intent) ?: return
        val ch = shareChannel
        if (ch != null) {
            ch.invokeMethod("onShareReceived", payload)
        } else {
            pendingInitialShare = payload
        }
    }

    private fun extractSharePayload(intent: Intent?): Map<String, Any?>? {
        if (intent == null) return null
        val action = intent.action ?: return null

        if (action == Intent.ACTION_VIEW) {
            val uri = intent.data ?: return null
            if (uri.host == "drop" || uri.path?.startsWith("/drop") == true) {
                val urlParam = uri.getQueryParameter("url")
                val textParam = uri.getQueryParameter("text")
                val combined = urlParam ?: textParam ?: return null
                return mapOf("text" to combined, "mimeType" to "text/plain")
            }
            return null
        }

        if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) {
            return null
        }
        val mime = intent.type ?: "text/plain"
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT)?.take(15_000)

        val stagedFiles = mutableListOf<String>()
        if (action == Intent.ACTION_SEND) {
            @Suppress("DEPRECATION")
            val streamUri = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
            }
            if (streamUri != null) {
                stageContentUri(streamUri, mime)?.let { stagedFiles.add(it) }
            }
        } else {
            @Suppress("DEPRECATION")
            val uris = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            }
            uris?.take(4)?.forEach { u ->
                stageContentUri(u, mime)?.let { stagedFiles.add(it) }
            }
        }

        if (stagedFiles.isEmpty() && sharedText.isNullOrBlank()) return null
        return mapOf(
            "text" to sharedText,
            "files" to stagedFiles,
            "mimeType" to mime,
        )
    }

    private fun stageContentUri(uri: Uri, mimeType: String): String? {
        return try {
            val resolver = applicationContext.contentResolver
            val dir = File(cacheDir, "shared_drop").apply { mkdirs() }
            val ext = when {
                mimeType.contains("png") -> "png"
                mimeType.contains("webp") -> "webp"
                mimeType.contains("mpeg") || mimeType.contains("mp3") -> "mp3"
                mimeType.contains("mp4") || mimeType.contains("m4a") -> "m4a"
                mimeType.contains("ogg") -> "ogg"
                mimeType.startsWith("audio/") -> "m4a"
                else -> "jpg"
            }
            val dest = File(dir, "${UUID.randomUUID()}.$ext")
            var total = 0L
            resolver.openInputStream(uri)?.use { input ->
                dest.outputStream().use { output ->
                    val buf = ByteArray(16_384)
                    while (true) {
                        val read = input.read(buf)
                        if (read <= 0) break
                        total += read
                        if (total > maxSharedFileBytes) {
                            dest.delete()
                            return null
                        }
                        output.write(buf, 0, read)
                    }
                }
            } ?: return null
            if (total == 0L) {
                dest.delete()
                return null
            }
            dest.absolutePath
        } catch (_: Exception) {
            null
        }
    }

    private fun resolveStoreService(store: String): Pair<String, String> {
        return if (store == "myket") {
            "ir.mservices.market" to "ir.mservices.market.billing.service.InAppBillingService.BIND"
        } else {
            "com.farsitel.bazaar" to "com.farsitel.bazaar.iab.InAppBillingService.BIND"
        }
    }

    private fun bindStoreBillingService(
        store: String,
        onConnected: (IBinder?, ServiceConnection?) -> Unit,
    ) {
        val (pkg, action) = resolveStoreService(store)
        val serviceIntent = Intent(action).apply { setPackage(pkg) }
        var connRef: ServiceConnection? = null
        val conn = object : ServiceConnection {
            override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
                onConnected(service, connRef)
            }

            override fun onServiceDisconnected(name: ComponentName?) {}
        }
        connRef = conn
        val bound = try {
            bindService(serviceIntent, conn, Context.BIND_AUTO_CREATE)
        } catch (_: Exception) {
            false
        }
        if (!bound) {
            onConnected(null, null)
        }
    }

    private fun safeUnbind(conn: ServiceConnection?) {
        if (conn == null) return
        try {
            unbindService(conn)
        } catch (_: Exception) {
        }
    }

    private fun iabIsBillingSupported(binder: IBinder): Int {
        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        return try {
            data.writeInterfaceToken("com.android.vending.billing.IInAppBillingService")
            data.writeInt(3)
            data.writeString(packageName)
            data.writeString("inapp")
            binder.transact(1, data, reply, 0)
            reply.readException()
            reply.readInt()
        } finally {
            reply.recycle()
            data.recycle()
        }
    }

    private fun iabGetPurchases(binder: IBinder): Bundle? {
        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        return try {
            data.writeInterfaceToken("com.android.vending.billing.IInAppBillingService")
            data.writeInt(3)
            data.writeString(packageName)
            data.writeString("inapp")
            data.writeString(null)
            binder.transact(4, data, reply, 0)
            reply.readException()
            if (reply.readInt() != 0) Bundle.CREATOR.createFromParcel(reply) else null
        } finally {
            reply.recycle()
            data.recycle()
        }
    }

    private fun iabGetBuyIntent(binder: IBinder, productId: String): Bundle? {
        val data = Parcel.obtain()
        val reply = Parcel.obtain()
        return try {
            data.writeInterfaceToken("com.android.vending.billing.IInAppBillingService")
            data.writeInt(3)
            data.writeString(packageName)
            data.writeString(productId)
            data.writeString("inapp")
            data.writeString("sanjia_iab_v3")
            binder.transact(3, data, reply, 0)
            reply.readException()
            if (reply.readInt() != 0) Bundle.CREATOR.createFromParcel(reply) else null
        } finally {
            reply.recycle()
            data.recycle()
        }
    }

    private fun handleIabQueryLatest(store: String, result: MethodChannel.Result) {
        bindStoreBillingService(store) { binder, conn ->
            try {
                if (binder == null || iabIsBillingSupported(binder) != 0) {
                    result.success(null)
                    return@bindStoreBillingService
                }
                val purchases = iabGetPurchases(binder)
                val dataList = purchases?.getStringArrayList("INAPP_PURCHASE_DATA_LIST")
                val latestJson = dataList?.lastOrNull()
                if (latestJson.isNullOrBlank()) {
                    result.success(null)
                } else {
                    val obj = JSONObject(latestJson)
                    result.success(
                        mapOf(
                            "purchaseToken" to obj.optString("purchaseToken"),
                            "productId" to obj.optString("productId"),
                        ),
                    )
                }
            } catch (e: Exception) {
                result.error("IAP_QUERY_FAILED", e.message ?: "Failed to query store purchases", null)
            } finally {
                safeUnbind(conn)
            }
        }
    }

    private fun handleIabLaunchPurchase(
        store: String,
        productId: String,
        result: MethodChannel.Result,
    ) {
        if (pendingIapResult != null) {
            result.error("IAP_BUSY", "Another purchase flow is already active.", null)
            return
        }
        bindStoreBillingService(store) { binder, conn ->
            try {
                if (binder == null || iabIsBillingSupported(binder) != 0) {
                    result.error(
                        "STORE_NOT_INSTALLED",
                        "Store billing service unavailable for $store.",
                        null,
                    )
                    return@bindStoreBillingService
                }
                val bundle = iabGetBuyIntent(binder, productId)
                val responseCode = bundle?.getInt("RESPONSE_CODE", -1) ?: -1
                if (responseCode != 0) {
                    result.error(
                        "IAP_INTENT_ERROR",
                        "Store returned billing response code $responseCode.",
                        null,
                    )
                    return@bindStoreBillingService
                }
                @Suppress("DEPRECATION")
                val pendingIntent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    bundle?.getParcelable("BUY_INTENT", PendingIntent::class.java)
                } else {
                    bundle?.getParcelable<PendingIntent>("BUY_INTENT")
                }
                if (pendingIntent == null) {
                    result.error("IAP_NO_PENDING_INTENT", "Missing store BUY_INTENT.", null)
                    return@bindStoreBillingService
                }
                pendingIapResult = result
                pendingIapProductId = productId
                startIntentSenderForResult(
                    pendingIntent.intentSender,
                    iranIapRequestCode,
                    Intent(),
                    0,
                    0,
                    0,
                )
            } catch (e: Exception) {
                pendingIapResult = null
                pendingIapProductId = null
                result.error("IAP_LAUNCH_FAILED", e.message ?: "Failed to launch billing flow", null)
            } finally {
                safeUnbind(conn)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == mediaPickerRequestCode) {
            val cb = pendingPickerResult
            val mime = pendingPickerMimeType
            val maxFiles = pendingPickerMaxFiles
            pendingPickerResult = null
            if (cb == null) {
                super.onActivityResult(requestCode, resultCode, data)
                return
            }
            if (resultCode != Activity.RESULT_OK || data == null) {
                cb.success(emptyList<String>())
                return
            }
            val out = mutableListOf<String>()
            val clipData = data.clipData
            if (clipData != null) {
                for (i in 0 until minOf(clipData.itemCount, maxFiles)) {
                    stageContentUri(clipData.getItemAt(i).uri, mime)?.let { out.add(it) }
                }
            } else {
                data.data?.let { u -> stageContentUri(u, mime)?.let { out.add(it) } }
            }
            cb.success(out)
            return
        }
        if (requestCode == iranIapRequestCode) {
            val cb = pendingIapResult
            val sku = pendingIapProductId
            pendingIapResult = null
            pendingIapProductId = null
            if (cb == null) {
                super.onActivityResult(requestCode, resultCode, data)
                return
            }
            if (resultCode != Activity.RESULT_OK || data == null) {
                cb.error("PURCHASE_CANCELLED", "Store purchase cancelled by user.", null)
                return
            }
            val purchaseData = data.getStringExtra("INAPP_PURCHASE_DATA")
            if (purchaseData.isNullOrBlank()) {
                cb.error("IAP_EMPTY_RECEIPT", "Store did not return purchase data.", null)
                return
            }
            try {
                val obj = JSONObject(purchaseData)
                val token = obj.optString("purchaseToken")
                val returnedSku = obj.optString("productId").ifBlank { sku.orEmpty() }
                if (token.isBlank()) {
                    cb.error("IAP_MISSING_TOKEN", "Store receipt missing purchaseToken.", null)
                } else {
                    cb.success(
                        mapOf(
                            "purchaseToken" to token,
                            "productId" to returnedSku,
                        ),
                    )
                }
            } catch (e: Exception) {
                cb.error("IAP_RECEIPT_PARSE_ERROR", e.message ?: "Invalid store receipt", null)
            }
            return
        }
        super.onActivityResult(requestCode, resultCode, data)
    }

    override fun onDestroy() {
        val request = activeFocusRequest
        if (request != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
            audioManager?.abandonAudioFocusRequest(request)
        }
        super.onDestroy()
    }
}
