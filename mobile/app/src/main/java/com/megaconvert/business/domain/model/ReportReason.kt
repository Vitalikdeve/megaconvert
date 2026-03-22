package com.megaconvert.business.domain.model

enum class ReportReason(val wireValue: String, val title: String) {
    SPAM("SPAM", "Спам"),
    FRAUD("FRAUD", "Мошенничество"),
    ILLEGAL_CONTENT("ILLEGAL_CONTENT", "Незаконный контент (DSA)")
}
