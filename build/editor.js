(function (wp) {
    var registerBlockType = wp.blocks.registerBlockType;
    var el = wp.element.createElement;
    var InspectorControls =
        (wp.blockEditor && wp.blockEditor.InspectorControls) ||
        (wp.editor && wp.editor.InspectorControls);
    var PanelBody = wp.components && wp.components.PanelBody;
    var TextControl = wp.components && wp.components.TextControl;
    var RangeControl = wp.components && wp.components.RangeControl;
    var useBlockProps = wp.blockEditor && wp.blockEditor.useBlockProps;

    registerBlockType("pt-remotegallery/gallery", {
        edit: function (props) {
            var blockProps = (useBlockProps && useBlockProps()) || {};
            var attributes = props.attributes || {};
            var setAttributes = props.setAttributes || function () {};
            var endpoint =
                attributes.endpoint ||
                "https://gallery.permanenttourist.ch/api";
            var imagesPerPage = attributes.imagesPerPage || 50;

            return el(
                "div",
                blockProps,
                el(
                    InspectorControls,
                    null,
                    el(
                        PanelBody,
                        { title: "Gallery settings", initialOpen: true },
                        el(TextControl, {
                            label: "API endpoint",
                            value: endpoint,
                            onChange: function (value) {
                                setAttributes({ endpoint: value });
                            },
                        }),
                        el(RangeControl, {
                            label: "Images per page",
                            value: imagesPerPage,
                            onChange: function (value) {
                                setAttributes({
                                    imagesPerPage: parseInt(value, 10) || 50,
                                });
                            },
                            min: 20,
                            max: 100,
                            step: 10,
                        }),
                    ),
                ),
                el(
                    "div",
                    { className: "pt-remotegallery-editor-placeholder" },
                    el(
                        "p",
                        null,
                        "Remote Gallery — placeholder (preview only). The gallery will render on the frontend).",
                    ),
                    el(
                        "p",
                        null,
                        "Endpoint: " +
                            endpoint +
                            " — " +
                            imagesPerPage +
                            " per page",
                    ),
                ),
            );
        },
        save: function () {
            return null; // server rendered
        },
    });
})(window.wp);
