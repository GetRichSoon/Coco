@file:OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)

package com.goodspace.cocolounge

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SegmentedButtonColors
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp

/*
 * The themed versions of the Material pieces the app uses. They live in this package under the Material names on purpose: Kotlin resolves a
 * package member before a star import, so every existing `TextButton(...)`, `FilterChip(...)`, `AlertDialog(...)` and `DropdownMenu(...)`
 * picks the theme up without being edited, and a screen added later gets it for free.
 */

/** Text buttons read as links: the accessible text colour of the accent family (`link`), never the vivid fill. */
@Composable
fun TextButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, content: @Composable RowScope.() -> Unit) =
    androidx.compose.material3.TextButton(onClick, modifier, enabled, colors = ButtonDefaults.textButtonColors(contentColor = LocalCocoRoles.current.link), content = content)

/** A selected chip wears the theme's selected state (primaryContainer = the `selected` role: pink in Signature). */
@Composable
fun FilterChip(
    selected: Boolean, onClick: () -> Unit, label: @Composable () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true,
    leadingIcon: (@Composable () -> Unit)? = null, trailingIcon: (@Composable () -> Unit)? = null, shape: Shape = FilterChipDefaults.shape,
) {
    val cs = MaterialTheme.colorScheme
    androidx.compose.material3.FilterChip(selected, onClick, label, modifier, enabled, leadingIcon = leadingIcon, trailingIcon = trailingIcon, shape = shape,
        colors = FilterChipDefaults.filterChipColors(selectedContainerColor = cs.primaryContainer, selectedLabelColor = cs.onPrimaryContainer,
            selectedLeadingIconColor = cs.onPrimaryContainer, selectedTrailingIconColor = cs.onPrimaryContainer))
}

/** Dialogs are panels: black with light text in Signature even when the page is lavender. */
@Composable
fun AlertDialog(
    onDismissRequest: () -> Unit, confirmButton: @Composable () -> Unit, modifier: Modifier = Modifier, dismissButton: (@Composable () -> Unit)? = null,
    icon: (@Composable () -> Unit)? = null, title: (@Composable () -> Unit)? = null, text: (@Composable () -> Unit)? = null,
) = CocoPanel {
    androidx.compose.material3.AlertDialog(onDismissRequest = onDismissRequest, confirmButton = confirmButton, modifier = modifier, dismissButton = dismissButton, icon = icon, title = title, text = text)
}

/** Menus are panels too. */
@Composable
fun DropdownMenu(expanded: Boolean, onDismissRequest: () -> Unit, modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) =
    CocoPanel { androidx.compose.material3.DropdownMenu(expanded = expanded, onDismissRequest = onDismissRequest, modifier = modifier, content = content) }

/** Segmented buttons: the chosen segment wears the selected state. */
@Composable
fun segmentedColors(): SegmentedButtonColors = MaterialTheme.colorScheme.let { cs ->
    SegmentedButtonDefaults.colors(activeContainerColor = cs.primaryContainer, activeContentColor = cs.onPrimaryContainer, activeBorderColor = cs.primaryContainer,
        inactiveContainerColor = Color.Transparent, inactiveContentColor = cs.onSurface, inactiveBorderColor = cs.outline)
}

/** A card-coloured surface for anything that is not a plain Card (tiles, menu rows): a panel with the card surface and a hairline. */
@Composable
fun PanelSurface(modifier: Modifier = Modifier, shape: Shape = RoundedCornerShape(16.dp), highlight: Boolean = false, content: @Composable () -> Unit) {
    CocoPanel {
        val cs = MaterialTheme.colorScheme; val r = LocalCocoRoles.current
        Surface(modifier, shape = shape, color = r.cardSurface, contentColor = cs.onSurface,
            border = if (highlight) BorderStroke(2.dp, r.link) else BorderStroke(1.dp, cs.outlineVariant), content = content)
    }
}

/**
 * Text fields focus in the accessible accent: Material draws the focused label, border and cursor in `primary`, which here is the vivid call to
 * action (3.4 to 4.4 : 1 on some cards). `link` is the contrast-checked text colour of the same family.
 */
@Composable
fun OutlinedTextField(
    value: String, onValueChange: (String) -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, readOnly: Boolean = false,
    textStyle: TextStyle = LocalTextStyle.current, label: (@Composable () -> Unit)? = null, placeholder: (@Composable () -> Unit)? = null,
    leadingIcon: (@Composable () -> Unit)? = null, trailingIcon: (@Composable () -> Unit)? = null, supportingText: (@Composable () -> Unit)? = null,
    isError: Boolean = false, visualTransformation: VisualTransformation = VisualTransformation.None, keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    keyboardActions: KeyboardActions = KeyboardActions.Default, singleLine: Boolean = false, maxLines: Int = if (singleLine) 1 else Int.MAX_VALUE, minLines: Int = 1,
    shape: Shape = OutlinedTextFieldDefaults.shape,
) {
    val link = LocalCocoRoles.current.link
    androidx.compose.material3.OutlinedTextField(value, onValueChange, modifier, enabled, readOnly, textStyle, label, placeholder, leadingIcon, trailingIcon,
        supportingText = supportingText, isError = isError, visualTransformation = visualTransformation, keyboardOptions = keyboardOptions, keyboardActions = keyboardActions,
        singleLine = singleLine, maxLines = maxLines, minLines = minLines, shape = shape,
        colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = link, focusedLabelColor = link, cursorColor = link))
}
