/**
 * Copyright (c) 2011-2016 by Andrew Mustun. All rights reserved.
 * 
 * This file is part of the QCAD project.
 *
 * QCAD is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * QCAD is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with QCAD.
 */

include("../WidgetFactory.js");

/**
 * \class LayerDialog
 * \ingroup ecma_layer
 * 
 * Creates a dialog to edit the attributes of a layer.
 *
 * \param document RDocument the layer is in.
 * \param layer RLayer object to edit or undefined to show a dialog for a new layer.
 */
function LayerDialog(document, layer) {
    this.dialog = null;
    this.document = document;
    this.layer = layer;
    this.prefix = undefined;
    this.defaultName = "layer %1";
}

/**
 * Hook for derived classes to do additional initialization.
 */
LayerDialog.prototype.initDialog = function(dialog, layer) {
};

/**
 * Hook for derived classes to store additional information back to layer.
 */
LayerDialog.prototype.initLayer = function(dialog, layer) {
};

/**
 * Hook for derived classes to return complete layer name.
 */
LayerDialog.prototype.getLayerName = function(dialog) {
    var leLayerName = dialog.findChild("LayerName");
    if (!isNull(this.prefix)) {
        return this.prefix + leLayerName.text;
    }
    return leLayerName.text;
};

LayerDialog.prototype.show = function() {
    this.dialog = WidgetFactory.createDialog("scripts/Layer", "LayerDialog.ui");
    //this.dialog.windowIcon = new QIcon("scripts/Layer/EditLayer/EditLayer.svg");

    var widgets = getWidgets(this.dialog);
    var leLayerName = widgets["LayerName"];
    var rx = new RegExp("[^<>/\\\\\":;\?\*|,=`]{1,255}");
    this.validator = new QRegExpValidator(rx, leLayerName);
    leLayerName.setValidator(this.validator);
    var cbColor = widgets["Color"];
    cbColor.setColor(RSettings.getColor("Layer/DefaultColor", new RColor("black")));
    var cbLineweight = widgets["Lineweight"];
    cbLineweight.setLineweight(RSettings.getIntValue("Layer/DefaultLineweight", RLineweight.Weight025));
    var cbLinetype = widgets["Linetype"];
    cbLinetype.init(this.document);

    // init from existing layer:
    if (!isNull(this.layer)) {
        leLayerName.text = this.layer.getName();

        if (leLayerName.text === "0") {
            leLayerName.enabled = false;
        }
        else {
            // only allow user to edit part after prefix:
            if (!isNull(this.prefix)) {
                if (leLayerName.text.startsWith(this.prefix)) {
                    leLayerName.text = leLayerName.text.substring(this.prefix.length);
                }
            }
        }

        // TODO: undeletable layers
        cbColor.setColor(this.layer.getColor());
        cbLineweight.setLineweight(this.layer.getLineweight());
        var ltP = this.document.queryLinetype(this.layer.getLinetypeId());
        if (!isNull(ltP)) {
            //lt = ltP.data();
            cbLinetype.setLinetypePattern(ltP.getPattern());
        }
    }

    // show prefix as part of the layer name label:
    var lLayerName = widgets["LayerNameLabel"];
    if (!isNull(this.prefix)) {
        lLayerName.text = lLayerName.text + " " + this.prefix;
    }

    leLayerName.textChanged.connect(this, "validate");

    this.initDialog(this.dialog, this.layer);

    this.dialog.show();

    if (isNull(this.layer)) {
        var c = 1;
        do {
            leLayerName.text = this.defaultName.arg(c);
            ++c;
        } while (!this.validate());
    }
    else {
        this.validate();
    }

    leLayerName.selectAll();

    if (!this.dialog.exec()) {
        this.dialog.destroy();
        EAction.activateMainWindow();
        return undefined;
    }

    var text = leLayerName.text.trim();
    if (!isNull(this.prefix)) {
        text = this.prefix + text;
    }
    var clr = cbColor.getColor();
    var lw = cbLineweight.getLineweight();
    var lt = cbLinetype.getLinetypePattern();
    var ltId = this.document.getLinetypeId(lt.getName());
    if (!isNull(this.layer)) {
        this.layer.setName(text);
        this.layer.setColor(clr);
        this.layer.setLinetypeId(ltId);
        this.layer.setLineweight(lw);
        this.initLayer(this.dialog, this.layer);
        return this.layer;
    }
    //this.dialog.setAttribute(Qt.WA_DeleteOnClose);
    //this.dialog.close();
    var layer = new RLayer(this.document, text, false, false,
            clr, ltId, lw);
    this.initLayer(this.dialog, layer);
    this.dialog.destroy();
    EAction.activateMainWindow();

    return layer;
};

/**
 * Layer name validation.
 */
LayerDialog.prototype.validate = function() {
    var widgets = getWidgets(this.dialog);

    var leLayerName = widgets["LayerName"];
    var message = widgets["Message"];
    var pos = 0;
    var acceptable = true;
    message.clear();
    var layerName = this.getLayerName(this.dialog);

    if (layerName!==layerName.trim()) {
        message.text = "<font color='red'>" + qsTr("Leading or trailing spaces.") + "</font>";
        acceptable = false;
    }

    if (this.validator.validate(layerName, pos) != QValidator.Acceptable) {
        message.text = "<font color='red'>" + qsTr("Layer name is empty.") + "</font>";
        acceptable = false;
    }

    // layer exists: check if name exists:
    if (this.document.hasLayer(layerName)) {
        // error if we're creating a new layer and the layer name is taken or
        // we're trying to rename a layer to an existing name
        if (isNull(this.layer) ||
            this.layer.getName().toLowerCase() !== layerName.toLowerCase()) {

            message.text = "<font color='red'>" + qsTr("Layer already exists.") + "</font>";
            acceptable = false;
        }
    }
    widgets["ButtonBox"].button(QDialogButtonBox.Ok).enabled = acceptable;
    return acceptable;
};