<?php
if (! defined('ABSPATH')) {
    exit;
}

function pt_remotegallery_render($attributes)
{
    $endpoint = isset($attributes['endpoint']) && $attributes['endpoint'] ? esc_url_raw($attributes['endpoint']) : 'https://gallery.permanenttourist.ch/api';
    $per_page = isset($attributes['imagesPerPage']) ? intval($attributes['imagesPerPage']) : 50;

    // Ensure assets are enqueued on the frontend when rendering the block
    if (! wp_is_block_theme()) {
        // still enqueue normally
    }
    wp_enqueue_script('pt-remotegallery-frontend');
    wp_enqueue_style('pt-remotegallery-style');

    $id = 'pt-remote-gallery-' . wp_rand();

    // Use WordPress block wrapper attributes to include alignment classes and other block-provided attributes
    $wrapper_attrs = array(
        'id' => $id,
        'class' => 'pt-remote-gallery',
        'data-endpoint' => esc_attr($endpoint),
        'data-images-per-page' => esc_attr($per_page),
    );

    $attr_string = get_block_wrapper_attributes($wrapper_attrs);

    $html = sprintf(
        '<div %s><div class="pt-remote-gallery__grid" aria-live="polite"></div><div class="pt-remote-gallery__pager"></div></div>',
        $attr_string
    );

    // A small inline script to kick the frontend script when multiple blocks exist
    $html .= '<script>document.addEventListener("DOMContentLoaded",function(){if(window.ptRemoteGalleryInit)window.ptRemoteGalleryInit();else{var ev=new Event("pt-remote-gallery-ready");document.dispatchEvent(ev);}});</script>';

    return $html;
}
