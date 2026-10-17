from django.utils.html import format_html


def thumb(image, size=64):
    """Small inline preview for an ImageField in admin lists/inlines."""
    if not image:
        return "—"
    try:
        url = image.url
    except ValueError:
        return "—"
    return format_html(
        '<a href="{}" target="_blank"><img src="{}" style="width:{}px;height:{}px;object-fit:cover;border-radius:6px" /></a>',
        url, url, size, size,
    )
