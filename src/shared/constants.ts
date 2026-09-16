export const CONTENT_SCRIPT_LOG_PREFIX = "[Chat Font Customizer]";

export const INJECTED_STYLE_ELEMENT_ID = "chat-font-customizer-style";

export const INJECTED_BIDI_STYLE_ELEMENT_ID = "chat-font-customizer-bidi-style";

/**
 * RastText-owned base-direction marker. Platforms may set this on a
 * logical text block after local script counting. It is not message
 * content, and it is safe to strip on disable.
 *
 * The generic BiDi engine opts these blocks out of `unicode-bidi:
 * plaintext` so first-strong inference cannot undo the resolved
 * direction. ChatGPT never sets this attribute.
 */
export const RASTTEXT_DIR_ATTRIBUTE = "data-rasttext-dir";
