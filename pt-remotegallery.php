<?php

/**
 * Plugin Name: Permanent Tourist: Remote Gallery Block
 * Description: Registers a simple Gutenberg block to display a remote gallery (frontend fetch + JS lightbox). Minimal, standalone implementation.
 * Version: 1.0.1
 * Author: Say Hello GmbH
 * Author URI: https://sayhello.ch
 * Text Domain: pt-remotegallery
 * Requires at least: 7.0
 * Requires PHP: 8.3
 */

if (! defined('ABSPATH')) {
    exit;
}

define('PT_REMOTEGALLERY_DIR', __DIR__);
define('PT_REMOTEGALLERY_URL', plugin_dir_url(__FILE__));

// Include render callback implementation kept in render.php
require_once PT_REMOTEGALLERY_DIR . '/render.php';

function pt_remotegallery_register_assets()
{
    $dir = PT_REMOTEGALLERY_DIR;
    $url = PT_REMOTEGALLERY_URL;

    // Editor script (shows a placeholder in the block editor)
    // Compute file-based cachebuster versions using filemtime when available.
    $editor_file = $dir . '/build/editor.js';
    $frontend_file = $dir . '/build/frontend.js';
    $style_file = $dir . '/build/style.css';

    $editor_ver = file_exists($editor_file) ? (string) filemtime($editor_file) : false;
    $frontend_ver = file_exists($frontend_file) ? (string) filemtime($frontend_file) : false;
    $style_ver = file_exists($style_file) ? (string) filemtime($style_file) : false;

    // Editor script (shows a placeholder in the block editor)
    wp_register_script(
        'pt-remotegallery-editor',
        $url . 'build/editor.js',
        array('wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components'),
        $editor_ver,
        true
    );

    // Frontend behaviour script
    wp_register_script(
        'pt-remotegallery-frontend',
        $url . 'build/frontend.js',
        array(),
        $frontend_ver,
        true
    );

    // Styles for both editor and front-end
    wp_register_style(
        'pt-remotegallery-style',
        $url . 'build/style.css',
        array(),
        $style_ver
    );

    // Register block using metadata and override scripts/styles + render callback
    if (function_exists('register_block_type_from_metadata')) {
        register_block_type_from_metadata(PT_REMOTEGALLERY_DIR, array(
            'editor_script' => 'pt-remotegallery-editor',
            'script'        => 'pt-remotegallery-frontend',
            'style'         => 'pt-remotegallery-style',
            'render_callback' => 'pt_remotegallery_render',
        ));
    }
}
add_action('init', 'pt_remotegallery_register_assets');
