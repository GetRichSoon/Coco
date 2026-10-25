package com.goodspace.cocolounge.island.service

import android.app.PendingIntent
import android.app.RemoteInput
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.widget.Toast
import com.goodspace.cocolounge.island.model.NoteAction
import com.goodspace.cocolounge.island.model.NoteLive
import com.goodspace.cocolounge.island.util.AppIcons

/** Target of the "Test reply" button: proves the island's Reply and Mark as read reach the app, like WhatsApp would. */
class ReplyTestReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val text = RemoteInput.getResultsFromIntent(intent)?.getCharSequence(KEY)
        val msg = if (text != null) "Coco Island: reply sent \"$text\"" else "Coco Island: marked as read"
        Toast.makeText(context, msg, Toast.LENGTH_LONG).show()
    }

    companion object {
        private const val KEY = "coco_reply"

        /** A message banner with the same two buttons WhatsApp gives: Reply (inline) and Mark as read. */
        fun sample(context: Context, stamp: Long): NoteLive {
            fun pi(code: Int) = PendingIntent.getBroadcast(
                context, code, Intent(context, ReplyTestReceiver::class.java).setAction("coco.test.$code"),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
            )
            val input = RemoteInput.Builder(KEY).setLabel("Reply").build()
            return NoteLive(
                id = "note:test-reply:$stamp", appName = "Coco", title = "Shreya", text = "Kal ka plan pakka?",
                icon = AppIcons.icon(context, context.packageName), open = null,
                actions = listOf(NoteAction("Reply", pi(1), null, remote = listOf(input)), NoteAction("Mark as read", pi(2), null)),
                isCall = false, pkg = "coco.test",
            )
        }
    }
}
