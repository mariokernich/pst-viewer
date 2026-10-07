package de.kernich.pstviewer.data

import androidx.annotation.StringRes
import de.kernich.pstviewer.R
import de.kernich.pstviewer.core.CoreException
import java.io.FileNotFoundException
import java.io.IOException

/** Error codes of the desktop app, with their messages. */
enum class ErrorCode(@param:StringRes val message: Int) {
    NOT_FOUND(R.string.error_not_found),
    NOT_PST(R.string.error_not_pst),
    READ_FAILED(R.string.error_read_failed),
    NOT_OPEN(R.string.error_not_open),
    CANCELED(R.string.error_canceled),
    UNKNOWN(R.string.error_unknown);

    companion object {
        fun of(error: Throwable): ErrorCode = when (error) {
            is CoreException.NotFound, is FileNotFoundException, is SecurityException -> NOT_FOUND
            is CoreException.Unsupported -> NOT_PST
            is CoreException.ReadFailed, is IOException -> READ_FAILED
            is CoreException.Closed -> NOT_OPEN
            is CoreException.Canceled -> CANCELED
            else -> UNKNOWN
        }
    }
}
