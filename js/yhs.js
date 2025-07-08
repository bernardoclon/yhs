// Import necessary Foundry VTT classes and functions.
// For example: import { ActorSheet, ItemSheet } from "@league-of-foundry-vtt/foundry-vtt-types/src/foundry/common/documents.mjs";

/**
 * Extends the ActorSheet class from Foundry VTT to create a custom character sheet for 'hunter' actors.
 */
class YokaiHunterSheet extends ActorSheet {

    /**
     * Defines the HTML template and default options for this character sheet.
     * @override
     * @returns {Object} Default options for the ActorSheet.
     */
    static get defaultOptions() {
        // Use foundry.utils.mergeObject for compatibility with Foundry VTT 12+
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/yokai-hunters-society/templates/actor-sheet.html",
            classes: ["yokai-hunters-society", "sheet", "actor"],
            width: 700,
            height: 610,
            resizable: false, // Disable sheet resizing
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }],
        });
    }

    /**
     * Prepares data for rendering the character sheet.
     * This includes actor data and ensures data robustness.
     * @override
     * @returns {Object} Data to be rendered in the sheet.
     */
    getData() {
        const data = super.getData();
        data.system = data.actor.system; // Access the actor's system data

        // Ensure 'attributes' and their sub-properties exist with default values.
        // This prevents errors if data is missing for new or incomplete actors.
        data.system.attributes = data.system.attributes || {};
        data.system.attributes.courage = data.system.attributes.courage || { value: 0 };
        data.system.attributes.selfControl = data.system.attributes.selfControl || { value: 0 };
        data.system.attributes.wisdom = data.system.attributes.wisdom || { value: 0 };
        data.system.attributes.sharpness = data.system.attributes.sharpness || { value: 0 };

        // Ensure 'health' and its sub-properties exist with default values.
        data.system.health = data.system.health || { value: 0, max: 0 };
        data.system.health.value = typeof data.system.health.value === 'undefined' || data.system.health.value === null ? 0 : data.system.health.value;
        data.system.health.max = typeof data.system.health.max === 'undefined' || data.system.health.max === null ? 0 : data.system.health.max;

        // Initialize curseResistance for new 'hunter' actors if not already defined.
        // This ensures the sheet displays correctly even before preCreateActor fully propagates.
        if (data.actor.type === "hunter" && !data.system.curseResistance) {
            data.system.curseResistance = {
                "1": true,
                "2": true,
                "3": false,
                "4": false
            };
            console.log("YokaiHunterSheet - getData: curseResistance initialized to TRUE for new 'hunter' actor in getData.");
        } else if (!data.system.curseResistance) {
            // For non-hunter types or existing hunters without the data, initialize to false.
            data.system.curseResistance = {
                "1": false,
                "2": false,
                "3": false,
                "4": false
            };
            console.log("YokaiHunterSheet - getData: curseResistance was initialized to false (did not exist and is not a new hunter).");
        }

        data.config = CONFIG.YOKAIHUNTERSSOCIETY; // Global configurations if any
        return data;
    }

    /**
     * Activates event listeners for the character sheet.
     * @param {JQuery} html The jQuery element representing the character sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);
        // If the sheet is not editable, do not activate editing listeners.
        if (!this.options.editable) return;

        // Listener for clickable attribute labels to roll.
        html.find('.rollable-attribute').click(this._onRollAttribute.bind(this));

        // Listeners for item management buttons.
        html.find('#add-item').click(this._onAddItem.bind(this));
        html.find('.edit-item-btn').click(this._onEditItem.bind(this));
        html.find('.remove-item-btn').click(this._onRemoveItem.bind(this));

        // Listener to toggle item description visibility.
        html.find('.item-name-clickable').click(this._onToggleItemDescription.bind(this));

        // Foundry's _onChangeInput method handles input changes, no custom listener needed here for submissions.
    }

    /**
     * Handles the logic for adding a new item to the actor.
     * @param {Event} event The click event.
     * @private
     */
    async _onAddItem(event) {
        event.preventDefault();
        const itemData = {
            name: game.i18n.localize("YOKAIHUNTERSSOCIETY.NewItem"), // Use localized string for "New Item"
            type: "equipment", // Ensure this matches an item type defined in template.json
            system: {
                description: "",
                bonus: 0 // Ensure bonus is initialized to 0
            }
        };
        await Item.create(itemData, { parent: this.actor });
    }

    /**
     * Handles the logic for editing an existing item.
     * @param {Event} event The click event.
     * @private
     */
    _onEditItem(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);

        if (item?.sheet) {
            item.sheet.render(true); // Open the item sheet for editing
        } else {
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ErrorOpeningSheet").replace("{item}", item?.name || 'el item'));
            console.error(`YokaiHunterSheet - _onEditItem: No item sheet found or item not found for ID: ${itemId}`);
        }
    }

    /**
     * Handles the logic for deleting an item from the actor.
     * Foundry VTT provides a default confirmation dialog for item deletion, but we'll use a custom one for consistency.
     * @param {Event} event The click event.
     * @private
     */
    async _onRemoveItem(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);

        if (!item) {
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemNotFound"));
            return;
        }

        // Custom confirmation dialog
        new Dialog({
            title: game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionTitle"),
            content: `<p>${game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionMessage").replace("{item}", item.name)}</p>`,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Delete"),
                    callback: async () => {
                        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                        ui.notifications.info(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemDeleted").replace("{item}", item.name));
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Cancel")
                }
            },
            default: "no"
        }).render(true);
    }

    /**
     * Handles clicking on an item name to show/hide its description.
     * @param {Event} event The click event.
     * @private
     */
    _onToggleItemDescription(event) {
        event.preventDefault();
        const itemElement = event.currentTarget.closest('.equipment-item-row');
        const descriptionElement = itemElement?.querySelector('.item-description-toggle');

        descriptionElement?.classList.toggle('hidden');
    }

    /**
     * Executed before updating the actor's data.
     * Applies capping logic for attributes and health.
     * @param {object} changed The data about to be updated.
     * @param {object} options Update options.
     * @param {string} user The ID of the user performing the update.
     * @override
     */
    async _preUpdate(changed, options, user) {
        // 1. Limit attributes to a maximum of 5.
        if (changed.system?.attributes) {
            for (const attr in changed.system.attributes) {
                if (typeof changed.system.attributes[attr].value === 'number') {
                    const currentAttrValue = changed.system.attributes[attr].value;
                    if (currentAttrValue > 5) {
                        changed.system.attributes[attr].value = 5;
                        ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.AttributeCapWarning").replace("{attribute}", game.i18n.localize(`YOKAIHUNTERSSOCIETY.${attr.charAt(0).toUpperCase() + attr.slice(1)}`)));
                    }
                }
            }
        }

        // 2. Limit maximum health to 15.
        if (typeof changed.system?.health?.max === 'number') {
            const currentMaxHealth = changed.system.health.max;
            if (currentMaxHealth > 15) {
                changed.system.health.max = 15;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning"));
            }
        }

        // 3. Current health value should not exceed maximum health.
        if (typeof changed.system?.health?.value === 'number') {
            // Get the *new* max health if it's being changed in this update, otherwise use current actor's max health.
            const effectiveMaxHealth = changed.system.health.max ?? this.actor.system.health.max;
            const newHealthValue = changed.system.health.value;

            if (newHealthValue > effectiveMaxHealth) {
                changed.system.health.value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning"));
            }
        }

        await super._preUpdate(changed, options, user);
    }

    /**
     * Overrides the default _onChangeInput method to apply capping logic and provide immediate feedback.
     * This method is called by Foundry when an input field changes.
     * @param {Event} event The change event.
     * @param {object} change The change data to be applied (initialized by Foundry).
     * @protected
     * @override
     */
    _onChangeInput(event, change = {}) {
        const input = event.currentTarget;
        const fieldName = input.name;
        let value = parseInt(input.value);

        // If the value is not a valid number, set it to 0.
        if (isNaN(value)) {
            value = 0;
        }

        // Apply capping logic directly and update the input value for immediate user feedback.
        if (fieldName.startsWith("system.attributes.")) {
            const attr = fieldName.split('.')[2]; // e.g., 'courage' from 'system.attributes.courage.value'
            if (value > 5) {
                value = 5;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.AttributeCapWarning").replace("{attribute}", game.i18n.localize(`YOKAIHUNTERSSOCIETY.${attr.charAt(0).toUpperCase() + attr.slice(1)}`)));
            }
            input.value = value; // Update DOM directly
        } else if (fieldName === "system.health.max") {
            if (value > 15) {
                value = 15;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning"));
            }
            // If max health changes, ensure current health doesn't exceed the new max.
            const currentHealthValue = this.actor.system.health?.value ?? 0;
            if (currentHealthValue > value) {
                // Update the current health input field as well.
                const currentHealthInput = this.element.find('input[name="system.health.value"]');
                if (currentHealthInput.length) {
                    currentHealthInput.val(value);
                }
                // Also ensure the 'change' object reflects this.
                foundry.utils.setProperty(change, "system.health.value", value);
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning"));
            }
            input.value = value; // Update DOM directly
        } else if (fieldName === "system.health.value") {
            const effectiveMaxHealth = (change.system?.health?.max !== undefined) ? change.system.health.max : (this.actor.system.health?.max ?? 0);
            if (value > effectiveMaxHealth) {
                value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning"));
            }
            input.value = value; // Update DOM directly
        }

        // Update the 'change' object that will be passed to the parent method.
        foundry.utils.setProperty(change, fieldName, value);

        // Call the parent method for Foundry to process the (now capped) changes.
        super._onChangeInput(event, change);
    }

    /**
     * Handles the attribute roll when its label is clicked.
     * @param {Event} event The click event.
     * @private
     */
    async _onRollAttribute(event) {
        event.preventDefault();
        const attribute = event.currentTarget.dataset.attribute;
        const localizedAttributeName = game.i18n.localize(`YOKAIHUNTERSSOCIETY.${attribute.charAt(0).toUpperCase() + attribute.slice(1)}`);

        // Robustness checks for actor and attribute data.
        // FIX: Ensure roll proceeds even if attribute value is 0.
        // The check now explicitly looks for undefined or null, allowing 0 as a valid value.
        if (this.actor?.system?.attributes?.[attribute]?.value === undefined || this.actor?.system?.attributes?.[attribute]?.value === null) {
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ErrorAttributeNotFound").replace("{attribute}", localizedAttributeName));
            console.error(`Error: Missing actor, system, attributes, or value for attribute '${attribute}'.`);
            return;
        }

        let attributeBaseValue = this.actor.system.attributes[attribute].value;
        const actorName = this.actor.name;
        const equipmentItems = this.actor.items.filter(item => item.type === "equipment");

        // Determine available curse resistances.
        const curseResistances = this.actor.system.curseResistance || {};
        const checkedCurseResistancesCount = Object.keys(curseResistances).filter(key => curseResistances[key]).length;
        const noCurseResistanceLeft = checkedCurseResistancesCount === 0;

        // Calculate encumbrance penalty for "courage" and "selfControl" attributes.
        let encumbrancePenalty = 0;
        const itemCount = equipmentItems.length;
        if (itemCount > 8 && (attribute === "courage" || attribute === "selfControl")) {
            encumbrancePenalty = (itemCount - 8); // Penalty is (items - 8)
        }
        let attributeValueWithPenalty = attributeBaseValue - encumbrancePenalty; // Subtract penalty

        // Build the HTML content for the roll dialog.
        const dialogContent = `
            <div class="yokai-hunters-society sheet actor dialog-roll-container">
                <form>
                    <div class="form-group">
                        <label>${game.i18n.localize("YOKAIHUNTERSSOCIETY.RollType")}:</label>
                        <div class="form-fields">
                            <label><input type="radio" name="rollType" value="normal" checked ${noCurseResistanceLeft ? 'disabled' : ''}> ${game.i18n.localize("YOKAIHUNTERSSOCIETY.Normal")}</label>
                            <label><input type="radio" name="rollType" value="advantage" ${noCurseResistanceLeft ? 'disabled' : ''}> ${game.i18n.localize("YOKAIHUNTERSSOCIETY.Advantage")}</label>
                            <label><input type="radio" name="rollType" value="disadvantage"> ${game.i18n.localize("YOKAIHUNTERSSOCIETY.Disadvantage")}</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" name="curseRoll" class="curse-checkbox-dialog" ${noCurseResistanceLeft ? 'disabled' : ''}>
                            <span class="curse-visual-checkbox-dialog">
                                <img src="systems/yokai-hunters-society/art/doll.png" class="curse-icon-img-dialog" alt="Curse Icon">
                            </span>
                            ${game.i18n.localize("YOKAIHUNTERSSOCIETY.CurseRoll")}
                        </label>
                    </div>
                    <div class="form-group">
                        <label for="equipmentSelect">${game.i18n.localize("YOKAIHUNTERSSOCIETY.SelectEquipment")}:</label>
                        <select id="equipmentSelect" name="selectedEquipment">
                            <option value="0">${game.i18n.localize("YOKAIHUNTERSSOCIETY.None")}</option>
                            ${equipmentItems.map(item => `<option value="${item.system.bonus}">${item.name} (${item.system.bonus >= 0 ? '+' : ''}${item.system.bonus})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group"></div>
                    <div class="form-group"></div>
                </form>
            </div>
        `;

        // Create the roll dialog.
        new Dialog({
            title: `${game.i18n.localize("YOKAIHUNTERSSOCIETY.RollOf")} ${localizedAttributeName}`,
            content: dialogContent,
            classes: ["yokai-hunters-society", "sheet", "actor"],
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Roll"),
                    callback: async (html) => {
                        const rollType = html.find('[name="rollType"]:checked').val();
                        let isCurseRoll = html.find('[name="curseRoll"]').prop('checked');
                        const selectedEquipmentBonus = parseInt(html.find('[name="selectedEquipment"]').val()) || 0;

                        // If no curse resistance is left, force disadvantage and disable curse roll.
                        if (noCurseResistanceLeft) {
                            isCurseRoll = false;
                        }

                        let baseDiceFormula;
                        switch (rollType) {
                            case "advantage":
                                baseDiceFormula = `3d6kh2`; // 3d6, keep highest 2
                                break;
                            case "disadvantage":
                                baseDiceFormula = `3d6kl2`; // 3d6, keep lowest 2
                                break;
                            default: // normal roll
                                baseDiceFormula = `2d6`; // 2d6
                                break;
                        }

                        const baseRoll = new Roll(baseDiceFormula);
                        await baseRoll.evaluate();

                        let customRollDisplayHtml = `<div class="yokai-hunters-society sheet actor roll-display-container">`;
                        let finalDiceSum = 0;
                        let rollObjectsForFoundry = [baseRoll]; // Array for Foundry's Dice So Nice and sound

                        if (isCurseRoll) {
                            // Curse Roll Logic: 2d6 + 1d8, drop lowest.
                            let allDiceResultsForTotal = [];
                            let curseRollResultForResistanceCheck = 0; // Raw 1d8 result for resistance check

                            // Add results from baseRoll (which is 2d6 when curse is active and rollType is normal)
                            baseRoll.dice.forEach(die => {
                                die.results.forEach(result => {
                                    allDiceResultsForTotal.push({ value: result.result, type: 'base', discarded: false });
                                });
                            });

                            // Roll the 1d8 curse die and add its result to the pool.
                            const curseDieForResistance = new Roll("1d8");
                            await curseDieForResistance.evaluate();
                            curseRollResultForResistanceCheck = curseDieForResistance.total;
                            rollObjectsForFoundry.push(curseDieForResistance);

                            curseDieForResistance.dice.forEach(die => {
                                die.results.forEach(result => {
                                    allDiceResultsForTotal.push({ value: result.result, type: 'curse', discarded: false });
                                });
                            });

                            // Sort all dice results to find the lowest.
                            allDiceResultsForTotal.sort((a, b) => a.value - b.value);

                            // Mark the lowest die as discarded for display.
                            if (allDiceResultsForTotal.length > 0) {
                                allDiceResultsForTotal[0].discarded = true;
                            }

                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.CurseRoll")}:</div>`;
                            customRollDisplayHtml += `<div class="roll-components-group">`;

                            allDiceResultsForTotal.forEach(die => {
                                const discardedClass = die.discarded ? 'discarded-die' : '';
                                const curseDieClass = die.type === 'curse' ? 'curse-die-roll' : '';
                                customRollDisplayHtml += `<div class="roll-component-tile ${discardedClass} ${curseDieClass}">${die.value}</div>`;
                                if (!die.discarded) {
                                    finalDiceSum += die.value;
                                }
                            });
                            customRollDisplayHtml += `</div>`;

                            // Curse Resistance Logic: Uncheck one resistance if 1d8 roll is higher than checked resistances.
                            if (curseRollResultForResistanceCheck > checkedCurseResistancesCount) {
                                let updatedCurseResistances = { ...curseResistances };
                                let uncheckedOne = false;
                                for (const key in updatedCurseResistances) {
                                    if (updatedCurseResistances[key]) {
                                        updatedCurseResistances[key] = false;
                                        uncheckedOne = true;
                                        break; // Uncheck only one
                                    }
                                }

                                if (uncheckedOne) {
                                    await this.actor.update({ 'system.curseResistance': updatedCurseResistances });
                                    customRollDisplayHtml += `<div class="roll-message-alert">${game.i18n.localize("YOKAIHUNTERSSOCIETY.CurseHasFallen")}</div>`;
                                }
                            }

                        } else {
                            // Standard Roll Display (no curse roll).
                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.Roll")} ${rollType === "advantage" ? game.i18n.localize("YOKAIHUNTERSSOCIETY.WithAdvantage") : (rollType === "disadvantage" ? game.i18n.localize("YOKAIHUNTERSSOCIETY.WithDisadvantage") : game.i18n.localize("YOKAIHUNTERSSOCIETY.Normal"))}:</div>`;
                            customRollDisplayHtml += `<div class="roll-components-group">`;
                            baseRoll.dice.forEach(die => {
                                die.results.forEach(result => {
                                    const discardedClass = result.discarded ? 'discarded-die' : '';
                                    customRollDisplayHtml += `<div class="roll-component-tile ${discardedClass}">${result.result}</div>`;
                                });
                            });
                            customRollDisplayHtml += `</div>`;
                            finalDiceSum = baseRoll.total;
                        }

                        // Display base attribute value.
                        customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.Attribute")}:</div><div class="roll-components-group"><div class="roll-component-tile">${attributeBaseValue}</div></div>`;

                        // Display encumbrance penalty if applicable.
                        if (encumbrancePenalty !== 0) {
                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.EncumbrancePenalty")}:</div><div class="roll-components-group"><div class="roll-component-tile">${-encumbrancePenalty}</div></div>`;
                        }

                        // Display selected equipment bonus.
                        if (selectedEquipmentBonus !== 0) {
                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.Equipment")}:</div><div class="roll-components-group"><div class="roll-component-tile">${selectedEquipmentBonus >= 0 ? '+' : ''}${selectedEquipmentBonus}</div></div>`;
                        }

                        // Calculate and display the final total result.
                        let totalResult = finalDiceSum + attributeValueWithPenalty + selectedEquipmentBonus;
                        customRollDisplayHtml += `<div class="roll-total-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.TotalResult")}:</div><div class="roll-components-group"><div class="roll-component-tile total-result">${totalResult}</div></div>`;

                        // Determine and display roll outcome (Success, Bad Omen, Failure).
                        let outcomeMessage = "";
                        let outcomeClass = "";
                        if (totalResult > 9) {
                            outcomeMessage = game.i18n.localize("YOKAIHUNTERSSOCIETY.Success");
                            outcomeClass = "roll-outcome-message--success";
                        } else if (totalResult === 9) {
                            outcomeMessage = game.i18n.localize("YOKAIHUNTERSSOCIETY.BadOmen");
                            outcomeClass = "roll-outcome-message--warning";
                        } else { // totalResult <= 8
                            outcomeMessage = game.i18n.localize("YOKAIHUNTERSSOCIETY.Failure");
                            outcomeClass = "roll-outcome-message--failure";
                        }
                        customRollDisplayHtml += `<div class="roll-outcome-message ${outcomeClass}">${outcomeMessage}</div>`;
                        customRollDisplayHtml += `</div></div>`; // Close roll-display-container and root container

                        // Create the chat message with the custom display and roll objects for Foundry's features.
                        await ChatMessage.create({
                            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                            flavor: customRollDisplayHtml,
                            rolls: rollObjectsForFoundry,
                            sound: CONFIG.sounds.dice
                        });
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Cancel")
                }
            },
            default: "roll",
            render: html => {
                // If no curse resistance is left, disable relevant dialog options and force disadvantage.
                if (noCurseResistanceLeft) {
                    html.find('input[name="rollType"][value="normal"]').prop('disabled', true);
                    html.find('input[name="rollType"][value="advantage"]').prop('disabled', true);
                    html.find('input[name="rollType"][value="disadvantage"]').prop('checked', true); // Force disadvantage
                    html.find('input[name="curseRoll"]').prop('disabled', true).prop('checked', false);
                }

                // Disable curse roll checkbox if Advantage or Disadvantage is selected in the dialog.
                html.find('input[name="rollType"]').on('change', function() {
                    const selectedRollType = $(this).val();
                    const curseCheckbox = html.find('input[name="curseRoll"]');
                    if (selectedRollType === 'advantage' || selectedRollType === 'disadvantage') {
                        curseCheckbox.prop('disabled', true).prop('checked', false);
                    } else {
                        // Re-enable if there are curse resistances left and it's not already disabled due to noCurseResistanceLeft.
                        if (!noCurseResistanceLeft) {
                            curseCheckbox.prop('disabled', false);
                        }
                    }
                });
            }
        }).render(true);
    }
}

/**
 * Extends the ItemSheet class from Foundry VTT to create a custom item sheet.
 */
class YokaiHunterItemSheet extends ItemSheet {

    /**
     * Defines the HTML template and default options for this item sheet.
     * @override
     * @returns {Object} Default options for the ItemSheet.
     */
    static get defaultOptions() {
        // Use foundry.utils.mergeObject for compatibility with Foundry VTT 12+
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/yokai-hunters-society/templates/item-sheet.html",
            classes: ["yokai-hunters-society", "sheet", "item"],
            width: 500,
            height: 430,
            resizable: false, // Disable sheet resizing
        });
    }

    /**
     * Prepares data for rendering the item sheet.
     * Ensures 'system.bonus' exists and handles display logic based on item type.
     * @override
     * @returns {Object} Data to be rendered in the sheet.
     */
    getData() {
        const data = super.getData();
        data.system = data.item.system;

        // Initialize 'bonus' to 0 for 'equipment' or 'gear' types if undefined/null/NaN.
        if (data.item.type === "equipment" || data.item.type === "gear") {
            if (typeof data.system.bonus === 'undefined' || data.system.bonus === null || isNaN(data.system.bonus)) {
                data.system.bonus = 0;
            }
            data.showBonusField = true; // Flag to indicate if the bonus field should be shown in HTML.
        } else if (data.item.type === "movimiento") {
            // Ensure 'system.bonus' does not exist for 'movimiento' items.
            delete data.system.bonus;
            data.showBonusField = false;
        } else {
            // For any other item type not explicitly handled.
            data.showBonusField = false;
        }
        return data;
    }

    /**
     * Activates event listeners for the item sheet.
     * @param {JQuery} html The jQuery element representing the item sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);
        // If the sheet is not editable, do not activate editing listeners.
        if (!this.options.editable) return;
        // Add specific listeners for the item sheet here if needed.
    }
}

/**
 * Extends the ActorSheet class from Foundry VTT to create a custom NPC/Yokai sheet.
 */
class YokaiNPCSheet extends ActorSheet {
    /**
     * Defines the HTML template and default options for this NPC/Yokai sheet.
     * @override
     * @returns {Object} Default options for the ActorSheet.
     */
    static get defaultOptions() {
        // Use foundry.utils.mergeObject for compatibility with Foundry VTT 12+
        return foundry.utils.mergeObject(super.defaultOptions, {
            template: "systems/yokai-hunters-society/templates/npc-yokai-sheet.html",
            classes: ["yokai-hunters-society", "sheet", "actor", "npc-yokai"],
            width: 375,
            height: 685,
            resizable: false, // Disable sheet resizing
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
        });
    }

    /**
     * Prepares data for rendering the NPC/Yokai sheet.
     * Ensures core properties exist and filters 'movimiento' items.
     * @override
     * @returns {Object} Data to be rendered in the sheet.
     */
    getData() {
        const data = super.getData();
        data.system = data.actor.system;

        // Ensure description and level exist, mapping from old properties if present.
        data.system.description = data.system.description ?? data.system.background ?? "";
        data.system.level = data.system.level ?? data.system.age ?? 0;

        // Ensure health object exists.
        data.system.health = data.system.health || { value: 0, max: 0 };

        // Filter and assign 'movimiento' items for display.
        data.movimientos = data.actor.items.filter(item => item.type === "movimiento");

        return data;
    }

    /**
     * Activates event listeners for the NPC/Yokai sheet.
     * @param {JQuery} html The jQuery element representing the sheet.
     * @override
     */
    activateListeners(html) {
        super.activateListeners(html);

        // If the sheet is not editable, do not activate editing listeners.
        if (!this.options.editable) return;

        // Listener for adding new 'movimiento' items.
        html.find('#add-movimiento').click(this._onAddMovimiento.bind(this));

        // Listeners for editing and removing items.
        html.find('.edit-item-btn').click(this._onEditItem.bind(this));
        html.find('.remove-item-btn').click(this._onRemoveItem.bind(this));

        // Listener to toggle item description visibility.
        html.find('.item-name-clickable').click(this._onToggleItemDescription.bind(this));

        // The _onChangeInput method will now handle health input changes directly.
        // The custom '.hp-money-input' listener has been removed from here.
    }

    /**
     * Handles adding a new 'movimiento' item to the actor's inventory.
     * @param {Event} event The click event.
     * @private
     */
    async _onAddMovimiento(event) {
        event.preventDefault();
        const itemData = {
            name: game.i18n.localize("YOKAIHUNTERSSOCIETY.NewItem"),
            type: "movimiento"
        };
        await Item.create(itemData, { parent: this.actor });
    }

    /**
     * Handles editing an existing item in the actor's inventory.
     * @param {Event} event The click event.
     * @private
     */
    _onEditItem(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);

        if (item?.sheet) {
            item.sheet.render(true); // Open the item sheet for editing.
        } else {
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ErrorOpeningSheet").replace("{item}", item?.name || 'el item'));
            console.error(`_onEditItem (NPC): No item sheet found or item not found for ID: ${itemId}`);
        }
    }

    /**
     * Handles removing an item from the actor's inventory.
     * @param {Event} event The click event.
     * @private
     */
    async _onRemoveItem(event) {
        event.preventDefault();
        const itemId = event.currentTarget.dataset.itemId;
        const item = this.actor.items.get(itemId);

        if (!item) {
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemNotFound"));
            return;
        }

        // Custom confirmation dialog
        new Dialog({
            title: game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionTitle"),
            content: `<p>${game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionMessage").replace("{item}", item.name)}</p>`,
            buttons: {
                yes: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Delete"),
                    callback: async () => {
                        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                        ui.notifications.info(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemDeleted").replace("{item}", item.name));
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Cancel")
                }
            },
            default: "no"
        }).render(true);
    }

    /**
     * Handles clicking on an item name to show/hide its description.
     * @param {Event} event The click event.
     * @private
     */
    _onToggleItemDescription(event) {
        event.preventDefault();
        const itemElement = event.currentTarget.closest('.equipment-item-row');
        const descriptionElement = itemElement?.querySelector('.item-description-toggle');

        descriptionElement?.classList.toggle('hidden');
    }

    /**
     * Executed before updating the actor's data.
     * Ensures health value does not exceed maximum health.
     * @param {object} changed The data about to be updated.
     * @param {object} options Update options.
     * @param {string} user The ID of the user performing the update.
     * @override
     */
    async _preUpdate(changed, options, user) {
        // Limit maximum health to 15.
        if (typeof changed.system?.health?.max === 'number') {
            const currentMaxHealth = changed.system.health.max;
            if (currentMaxHealth > 15) {
                changed.system.health.max = 15;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning"));
            }
        }

        // Current health value should not exceed maximum health.
        if (typeof changed.system?.health?.value === 'number') {
            // Get the *new* max health if it's being changed in this update, otherwise use current actor's max health.
            const effectiveMaxHealth = changed.system.health.max ?? (this.actor.system.health?.max ?? 0);
            const newHealthValue = changed.system.health.value;

            if (newHealthValue > effectiveMaxHealth) {
                changed.system.health.value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning"));
            }
        }

        await super._preUpdate(changed, options, user);
    }

    /**
     * Overrides the default _onChangeInput method to apply capping logic and provide immediate feedback for NPC health.
     * This method is called by Foundry when an input field changes.
     * @param {Event} event The change event.
     * @param {object} change The change data to be applied.
     * @protected
     * @override
     */
    _onChangeInput(event, change = {}) {
        const input = event.currentTarget;
        const fieldName = input.name;
        let value = parseInt(input.value);

        if (isNaN(value)) {
            value = 0;
        }

        // Apply capping logic directly and update the input value for immediate user feedback.
        if (fieldName === "system.health.max") {
            if (value > 15) {
                value = 15;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning"));
            }
            // If max health changes, ensure current health doesn't exceed the new max.
            const currentHealthValue = this.actor.system.health?.value ?? 0;
            if (currentHealthValue > value) {
                const currentHealthInput = this.element.find('input[name="system.health.value"]');
                if (currentHealthInput.length) {
                    currentHealthInput.val(value);
                }
                foundry.utils.setProperty(change, "system.health.value", value);
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning"));
            }
            input.value = value;
        } else if (fieldName === "system.health.value") {
            const effectiveMaxHealth = (change.system?.health?.max !== undefined) ? change.system.health.max : (this.actor.system.health?.max ?? 0);
            if (value > effectiveMaxHealth) {
                value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning"));
            }
            input.value = value;
        }

        // Update the 'change' object that will be passed to the parent method.
        foundry.utils.setProperty(change, fieldName, value);

        // Call the parent method for Foundry to process the (now capped) changes.
        super._onChangeInput(event, change);
    }
}


// Registers custom sheets with Foundry VTT when the 'init' hook fires.
Hooks.on("init", function() {
    // Unregister default sheets to prevent conflicts with custom ones.
    Actors.unregisterSheet("core", ActorSheet);
    Items.unregisterSheet("core", ItemSheet);

    // Register the custom character sheet for 'hunter' actors.
    Actors.registerSheet("yokai-hunters-society", YokaiHunterSheet, {
        types: ["hunter"],
        makeDefault: true,
        label: "Yokai Hunters Society Sheet"
    });

    // Register the custom NPC/Yokai sheet for 'npcYokai' actors.
    Actors.registerSheet("yokai-hunters-society", YokaiNPCSheet, {
        types: ["npcYokai"],
        makeDefault: false,
        label: "NPC/Yokai Sheet"
    });

    // Register the custom item sheet for 'equipment' and 'gear' types.
    Items.registerSheet("yokai-hunters-society", YokaiHunterItemSheet, {
        types: ["equipment", "gear"],
        makeDefault: true,
        label: "Yokai Hunters Society Item Sheet"
    });

    // Register the custom item sheet for the 'movimiento' type, reusing the same sheet class.
    Items.registerSheet("yokai-hunters-society", YokaiHunterItemSheet, {
        types: ["movimiento"],
        makeDefault: false,
        label: "Movimiento Sheet"
    });

    // Define global configuration for localization.
    CONFIG.YOKAIHUNTERSSOCIETY = {
        // Add any global configurations needed here.
        // For example, if you had specific item types or attributes that needed to be referenced globally.
    };
});

// Hook to set default curse resistance for new "hunter" actors before creation.
Hooks.on("preCreateActor", (actorDocument, data, options, userId) => {
    // Check if the actor being created is of type "hunter".
    if (data.type === "hunter") {
        console.log("preCreateActor: Creating a 'hunter' actor. Setting default curse resistance.");
        // Ensure 'system' and 'curseResistance' objects exist.
        data.system = data.system || {};
        data.system.curseResistance = data.system.curseResistance || {};
        // Set all curse resistance checkboxes to true by default.
        data.system.curseResistance["1"] = true;
        data.system.curseResistance["2"] = true;
        data.system.curseResistance["3"] = true;
        data.system.curseResistance["4"] = true;
    }
});
