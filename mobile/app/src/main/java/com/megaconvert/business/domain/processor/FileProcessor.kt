package com.megaconvert.business.domain.processor

import android.net.Uri
import java.io.File

interface FileProcessor {
    suspend fun process(inputUri: Uri, params: ProcessParams): Result<File>
}

data class ProcessParams(
    val width: Int,
    val height: Int,
    val quality: Int
)
