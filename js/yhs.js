// No se necesitan sentencias import para las clases globales de Foundry VTT.
// Se accede a ellas directamente a través de sus espacios de nombres (ej: foundry.appv1.sheets.ActorSheet).


/**
 * Extends the ActorSheet class from Foundry VTT to create a custom character sheet for 'hunter' actors.
 */
class YokaiHunterSheet extends foundry.appv1.sheets.ActorSheet { // Usar la ruta con espacio de nombres
    constructor(...args) {
        super(...args);
        // Initialize attributeInputs as an instance property for this sheet.
        // Each object stores the reference to the HTML label element, its associated input element,
        // its current calculated limit, and its previous valid value.
        this.attributeInputs = [
            { attributeName: 'courage', labelElement: null, inputElement: null, currentLimit: 5, previousValue: 0 },
            { attributeName: 'selfControl', labelElement: null, inputElement: null, currentLimit: 5, previousValue: 0 },
            { attributeName: 'wisdom', labelElement: null, inputElement: null, currentLimit: 5, previousValue: 0 },
            { attributeName: 'sharpness', labelElement: null, inputElement: null, currentLimit: 5, previousValue: 0 }
        ];
    }

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
            width: 795,
            height: 720,
            resizable: true,
            scrollY: [".sheet-body"],
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

        // ***********************************************************************************
        // INICIALIZACIÓN Y LISTENERS PARA LÍMITES DE ATRIBUTOS DINÁMICOS
        // ***********************************************************************************

        this.attributeInputs.forEach(inputObj => {
            // Usa `html.find()` para buscar el elemento label por su data-attribute.
            const labelElement = html.find(`.rollable-attribute[data-attribute="${inputObj.attributeName}"]`)[0];
            
            if (labelElement) { // Asegura que el label fue encontrado
                inputObj.labelElement = labelElement;
                // Encuentra el elemento input asociado, asumiendo que es el siguiente hermano.
                const inputElement = labelElement.nextElementSibling; 

                if (inputElement && inputElement.tagName === 'INPUT') { // Asegura que el siguiente hermano es un input
                    inputObj.inputElement = inputElement;
                    // Inicializa previousValue desde los datos del actor si están disponibles, de lo contrario 0.
                    // Esto asegura un estado inicial correcto al abrir la hoja.
                    inputObj.previousValue = parseInt(this.actor.system.attributes[inputObj.attributeName]?.value) || 0;

                    // Adjunta el event listener directamente al elemento DOM para el evento 'input'.
                    inputElement.oninput = this._checkAttributeLimits.bind(this);
                } else {
                    console.warn(`Foundry VTT: Elemento input no encontrado o no es un input para el atributo ${inputObj.attributeName}. Verifica tu actor-sheet.html.`);
                    inputObj.inputElement = null; // Asegura que la referencia sea nula si no se encuentra
                }
            } else {
                console.warn(`Foundry VTT: Elemento label para el atributo ${inputObj.attributeName} no encontrado en la hoja de personaje. Asegúrate de que el data-attribute sea correcto en actor-sheet.html.`);
                inputObj.labelElement = null; // Asegura que la referencia sea nula si no se encuentra
            }
        });

        // Llama a la función principal para establecer los límites iniciales y asegurar la visualización correcta.
        // Solo llama si al menos un elemento de atributo fue encontrado para evitar errores si no hay inputs de atributos.
        const hasAnyAttributeElements = this.attributeInputs.some(inputObj => inputObj.inputElement !== null);
        if (hasAnyAttributeElements) {
            this._updateAllAttributeLimits();
        } else {
            console.warn("Foundry VTT: No se encontraron elementos de atributo válidos para aplicar límites dinámicos. Verifica tu actor-sheet.html.");
        }

        // ***********************************************************************************
        // FIN DE LÓGICA DE LÍMITES DE ATRIBUTOS DINÁMICOS
        // ***********************************************************************************


        // Listener for clickable attribute labels to roll.
        html.find('.rollable-attribute').click(this._onRollAttribute.bind(this));

        // Listeners for item management buttons.
        html.find('#add-item').click(this._onAddItem.bind(this));
        html.find('.edit-item-btn').click(this._onEditItem.bind(this));
        html.find('.remove-item-btn').click(this._onRemoveItem.bind(this));

        // Listener to toggle item description visibility.
        html.find('.item-name-clickable').click(this._onToggleItemDescription.bind(this));

        // Foundry's _onChangeInput method handles input changes, no custom listener needed here for submissions.
        // We have modified _onChangeInput to defer attribute capping to our custom logic.
    }

    /**
     * Handles the logic for adding a new item to the actor.
     * @param {Event} event The click event.
     * @private
     */
    async _onAddItem(event) {
        event.preventDefault();
        const itemData = {
            name: game.i18n.localize("YOKAIHUNTERSSOCIETY.NewItem"), // Usar la función de localización de Foundry
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
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ErrorOpeningSheet").replace("{item}", item?.name || 'el item')); // Usar la función de localización de Foundry
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
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemNotFound")); // Usar la función de localización de Foundry
            return;
        }

        // Custom confirmation dialog
        new Dialog({
            title: game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionTitle"), // Usar la función de localización de Foundry
            content: `<p>${game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionMessage").replace("{item}", item.name)}</p>`, // Usar la función de localización de Foundry
            buttons: {
                yes: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Delete"), // Usar la función de localización de Foundry
                    callback: async () => {
                        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                        ui.notifications.info(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemDeleted").replace("{item}", item.name)); // Usar la función de localización de Foundry
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Cancel") // Usar la función de localización de Foundry
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
        // REMOVED: Attribute capping logic from here.
        // It is now handled by `_checkAttributeLimits` which modifies the DOM input value
        // before Foundry's change detection or submission.
        // Keeping it here would be redundant and potentially conflicting.

        // 2. Limit maximum health to 15.
        if (typeof changed.system?.health?.max === 'number') {
            const currentMaxHealth = changed.system.health.max;
            if (currentMaxHealth > 15) {
                changed.system.health.max = 15;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning")); // Usar la función de localización de Foundry
            }
        }

        // 3. Current health value should not exceed maximum health.
        if (typeof changed.system?.health?.value === 'number') {
            // Get the *new* max health if it's being changed in this update, otherwise use current actor's max health.
            const effectiveMaxHealth = changed.system.health.max ?? this.actor.system.health.max;
            const newHealthValue = changed.system.health.value;

            if (newHealthValue > effectiveMaxHealth) {
                changed.system.health.value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning")); // Usar la función de localización de Foundry
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

        // For attribute inputs, the capping and immediate DOM update is handled by _checkAttributeLimits.
        // Here, we just ensure the change object reflects the current DOM value.
        if (fieldName.startsWith("system.attributes.")) {
            // No direct capping here, it's handled by _checkAttributeLimits on 'input' event.
            // Just ensure the change object reflects the current (potentially adjusted) value.
            foundry.utils.setProperty(change, fieldName, value);
        }
        // Keep health/money capping logic as it's separate.
        else if (fieldName === "system.health.max") {
            if (value > 15) {
                value = 15;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning")); // Usar la función de localización de Foundry
            }
            // If max health changes, ensure current health doesn't exceed the new max.
            const currentHealthValue = this.actor.system.health?.value ?? 0;
            if (currentHealthValue > value) {
                const currentHealthInput = this.element.find('input[name="system.health.value"]');
                if (currentHealthInput.length) {
                    currentHealthInput.val(value);
                }
                foundry.utils.setProperty(change, "system.health.value", value);
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning")); // Usar la función de localización de Foundry
            }
            input.value = value;
            foundry.utils.setProperty(change, fieldName, value);
        } else if (fieldName === "system.health.value") {
            const effectiveMaxHealth = (change.system?.health?.max !== undefined) ? change.system.max : (this.actor.system.health?.max ?? 0);
            if (value > effectiveMaxHealth) {
                value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning")); // Usar la función de localización de Foundry
            }
            input.value = value;
        } else {
             // For other fields, just ensure the change object is set.
            foundry.utils.setProperty(change, fieldName, value);
        }

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

        // La verificación defensiva se ha simplificado ya que confiamos en que game.i18n.localize estará disponible.
        // Si aún así falla, el problema es más fundamental en la inicialización de Foundry.
        if (typeof game === 'undefined' || !game.i18n || typeof game.i18n.localize !== 'function') {
            ui.notifications.error("Foundry VTT: Error crítico de localización. Asegúrate de que tu sistema/módulo esté inicializado correctamente.");
            console.error("Foundry VTT: game.i18n.localize no está definido o no es una función. Esto indica un problema grave en la inicialización del sistema.");
            return;
        }

        const attribute = event.currentTarget.dataset.attribute;
        const localizedAttributeName = game.i18n.localize(`YOKAIHUNTERSSOCIETY.${attribute.charAt(0).toUpperCase() + attribute.slice(1)}`); // Usar la función de localización de Foundry

        // Robustness checks for actor and attribute data.
        // FIX: Ensure roll proceeds even if attribute value is 0.
        // The check now explicitly looks for undefined or null, allowing 0 as a valid value.
        if (this.actor?.system?.attributes?.[attribute]?.value === undefined || this.actor?.system?.attributes?.[attribute]?.value === null) {
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ErrorAttributeNotFound").replace("{attribute}", localizedAttributeName)); // Usar la función de localización de Foundry
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
                    <div class="main-contentd">
                    <div class="form-group">
                        <label>${game.i18n.localize("YOKAIHUNTERSSOCIETY.RollType")}:</label>
                        <div class="form-fields">
                            <div><label><input type="radio" name="rollType" value="normal" checked ${noCurseResistanceLeft ? 'disabled' : ''}> ${game.i18n.localize("YOKAIHUNTERSSOCIETY.Normal")}</label></div>
                            <div><label><input type="radio" name="rollType" value="advantage" ${noCurseResistanceLeft ? 'disabled' : ''}> ${game.i18n.localize("YOKAIHUNTERSSOCIETY.Advantage")}</label></div>
                            <div><label><input type="radio" name="rollType" value="disadvantage"> ${game.i18n.localize("YOKAIHUNTERSSOCIETY.Disadvantage")}</label></div>
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
                    </div>
                </form>
            </div>
        `;

        // Create the roll dialog.
        new Dialog({
            title: `${game.i18n.localize("YOKAIHUNTERSSOCIETY.RollOf")} ${localizedAttributeName}`, // Usar la función de localización de Foundry
            content: dialogContent,
            classes: ["yokai-hunters-society", "sheet", "actor"],
            buttons: {
                roll: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Roll"), // Usar la función de localización de Foundry
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

                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.CurseRoll")}:</div>`; // Usar la función de localización de Foundry
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
                                    customRollDisplayHtml += `<div class="roll-message-alert">${game.i18n.localize("YOKAIHUNTERSSOCIETY.CurseHasFallen")}</div>`; // Usar la función de localización de Foundry
                                }
                            }

                        } else {
                            // Standard Roll Display (no curse roll).
                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.Roll")} ${rollType === "advantage" ? game.i18n.localize("YOKAIHUNTERSSOCIETY.WithAdvantage") : (rollType === "disadvantage" ? game.i18n.localize("YOKAIHUNTERSSOCIETY.WithDisadvantage") : game.i18n.localize("YOKAIHUNTERSSOCIETY.Normal"))}:</div>`; // Usar la función de localización de Foundry
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
                        customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.Attribute")}:</div><div class="roll-components-group"><div class="roll-component-tile">${attributeBaseValue}</div></div>`; // Usar la función de localización de Foundry

                        // Display encumbrance penalty if applicable.
                        if (encumbrancePenalty !== 0) {
                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.EncumbrancePenalty")}:</div><div class="roll-components-group"><div class="roll-component-tile">${-encumbrancePenalty}</div></div>`; // Usar la función de localización de Foundry
                        }

                        // Display selected equipment bonus.
                        if (selectedEquipmentBonus !== 0) {
                            customRollDisplayHtml += `<div class="roll-component-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.Equipment")}:</div><div class="roll-components-group"><div class="roll-component-tile">${selectedEquipmentBonus >= 0 ? '+' : ''}${selectedEquipmentBonus}</div></div>`; // Usar la función de localización de Foundry
                        }

                        // Calculate and display the final total result.
                        let totalResult = finalDiceSum + attributeValueWithPenalty + selectedEquipmentBonus;
                        customRollDisplayHtml += `<div class="roll-total-label">${game.i18n.localize("YOKAIHUNTERSSOCIETY.TotalResult")}:</div><div class="roll-components-group"><div class="roll-component-tile total-result">${totalResult}</div></div>`; // Usar la función de localización de Foundry

                        // Determine and display roll outcome (Success, Bad Omen, Failure).
                        let outcomeMessage = "";
                        let outcomeClass = "";
                        if (totalResult > 9) {
                            outcomeMessage = game.i18n.localize("YOKAIHUNTERSSOCIETY.Success"); // Usar la función de localización de Foundry
                            outcomeClass = "roll-outcome-message--success";
                        } else if (totalResult === 9) {
                            outcomeMessage = game.i18n.localize("YOKAIHUNTERSSOCIETY.BadOmen"); // Usar la función de localización de Foundry
                            outcomeClass = "roll-outcome-message--warning";
                        } else { // totalResult <= 8
                            outcomeMessage = game.i18n.localize("YOKAIHUNTERSSOCIETY.Failure"); // Usar la función de localización de Foundry
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
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Cancel") // Usar la función de localización de Foundry
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

    // ***********************************************************************************
    // LÓGICA DE LÍMITES DINÁMICOS PARA ATRIBUTOS (MOVIDA A MÉTODOS DE CLASE)
    // ***********************************************************************************

    /**
     * Función llamada cada vez que el valor de un input de atributo cambia.
     * Gestiona la reversión del cambio si excede el límite y luego actualiza todos los límites.
     * @param {Event} event - El objeto de evento del input.
     * @private
     */
    _checkAttributeLimits(event) {
        const changedInputElement = event.target; // El elemento input que el usuario está modificando
        // Encuentra el objeto de atributo correspondiente en el array attributeInputs
        const changedInputObj = this.attributeInputs.find(input => input.inputElement === changedInputElement);

        if (!changedInputObj) {
            console.error("Foundry VTT: Objeto de input modificado no encontrado en el array attributeInputs.");
            return;
        }

        const newValue = parseInt(changedInputElement.value);
        const oldValue = changedInputObj.previousValue; // El valor que tenía antes de este intento de cambio

        // Establece temporalmente el valor del input modificado para el próximo cálculo de límites.
        // Esto asegura que el cálculo considere el *nuevo valor intencionado*.
        changedInputObj.inputElement.value = newValue;

        // Primero, actualiza todos los límites internos basándose en el estado actual de los inputs.
        // Este cálculo determinará el límite *permitido* para cada input si los cambios actuales fueran aceptados.
        this._updateAllAttributeLimits();

        // Ahora, verifica si el NUEVO valor del input que se está cambiando excede su límite *recién calculado*.
        if (newValue > changedInputObj.currentLimit) {
            // Si excede, revierte el valor del input a su estado válido anterior.
            changedInputElement.value = oldValue;
        }
        // Asegura que el valor no sea menor que 0, según el atributo min="0"
        if (newValue < 0) {
            changedInputElement.value = 0;
        }

        // Después de una posible reversión, actualiza el `previousValue` del input
        // al valor final y válido que tiene ahora.
        changedInputObj.previousValue = parseInt(changedInputElement.value);

        // Una segunda llamada a `_updateAllAttributeLimits` es crucial aquí.
        // Si un input fue revertido, los límites para otros inputs podrían necesitar recalcularse.
        // Por ejemplo, si un input fue revertido de 5 a 4, otro input podría ahora ser capaz de alcanzar 5.
        this._updateAllAttributeLimits();
    }

    /**
     * Función principal para determinar y aplicar los límites dinámicos a todos los inputs de atributos.
     * Esta función contiene la lógica para evitar que se "roben" límites superiores.
     * NOTA: Esta función NO MODIFICA directamente los valores de los inputs en el DOM,
     * solo su propiedad interna `currentLimit`. La modificación del valor se maneja en `_checkAttributeLimits`.
     * @private
     */
    _updateAllAttributeLimits() {
        // Paso 1: Determinar los límites "ideales" para cada input basándose en el estado actual.

        // Filtra `attributeInputs` para asegurar que solo procesamos objetos con un `inputElement` válido.
        const validAttributeInputs = this.attributeInputs.filter(inputObj => {
            if (!inputObj.inputElement) {
                // Esta advertencia solo se mostrará si un elemento no se encontró,
                // y el objeto será filtrado para evitar el error.
                console.warn(`Foundry VTT: Input object for attribute ${inputObj.attributeName} has no inputElement reference and will be skipped in _updateAllAttributeLimits filter.`);
            }
            return inputObj.inputElement; // Solo mantiene si 'inputElement' no es null/undefined
        });

        // Crea una copia de los estados de los inputs, asegurando que 'inputElement' es válido.
        const inputStates = validAttributeInputs.map(inputObj => ({
            attributeName: inputObj.attributeName,
            // Utilizamos el operador de encadenamiento opcional `?.` para prevenir el error
            // si por alguna razón `inputObj.inputElement` fuera `undefined` o `null` aquí.
            value: parseInt(inputObj.inputElement?.value) || 0,
            previousValue: inputObj.previousValue,
            originalInputObj: inputObj               // Referencia al objeto original en el array `attributeInputs`
        }));

        // Ordena los inputs para determinar quién "reclama" los límites más altos.
        // La prioridad es:
        // 1. Por valor actual (descendente): El input con el valor más alto va primero.
        // 2. Por valor anterior (descendente): Si los valores actuales son iguales, el que ya tenía un valor más alto antes tiene prioridad.
        // 3. Por nombre de atributo (alfabético): Para un desempate estable si todo lo demás es igual.
        inputStates.sort((a, b) => {
            if (a.value !== b.value) return b.value - a.value; // Prioriza el valor actual más alto
            if (a.previousValue !== b.previousValue) return b.previousValue - a.previousValue; // Luego, el valor anterior más alto
            return a.attributeName.localeCompare(b.attributeName); // Finalmente, por nombre de atributo para consistencia
        });

        // Variables para rastrear si los "slots" de límite (5, 4, 3) ya han sido asignados.
        let limit5Assigned = false;
        let limit4Assigned = false;
        let limit3Assigned = false;

        // Itera sobre los inputs ordenados para asignar límites.
        for (const state of inputStates) {
            const inputObj = state.originalInputObj;
            const currentValue = state.value;

            // Límite por defecto para este input en esta iteración.
            let assignedLimit = 5;

            if (!limit5Assigned) {
                // Si el "slot" para 5 no ha sido tomado aún.
                if (currentValue >= 5) {
                    // Este input es el primero en alcanzar o intentar alcanzar 5, así que lo "reclama".
                    assignedLimit = 5;
                    limit5Assigned = true;
                } else {
                    // Este input aún no ha llegado a 5, pero el slot de 5 está disponible.
                    assignedLimit = 5;
                }
            } else if (!limit4Assigned) {
                // Si el slot de 5 está tomado, y el de 4 no.
                if (currentValue >= 4) {
                    // Este input es el primero en alcanzar o intentar alcanzar 4 (después de que el slot de 5 está tomado), lo "reclama".
                    assignedLimit = 4;
                    limit4Assigned = true;
                } else {
                    // Este input aún no ha llegado a 4, pero el slot de 4 está disponible.
                    assignedLimit = 4;
                }
            } else if (!limit3Assigned) {
                // Si los slots de 5 y 4 están tomados, y el de 3 no.
                if (currentValue >= 3) {
                    // Este input es el primero en alcanzar o intentar alcanzar 3 (después de los slots de 5 y 4), lo "reclama".
                    assignedLimit = 3;
                    limit3Assigned = true;
                } else {
                    // Este input aún no ha llegado a 3, pero el slot de 3 está disponible.
                    assignedLimit = 3;
                }
            } else {
                // Si todos los "slots" superiores (5, 4, 3) están tomados, este es el último input.
                assignedLimit = 2;
            }

            // Asigna el límite calculado al objeto original del input.
            inputObj.currentLimit = assignedLimit;
        }

        // Paso 2: Actualizar la visualización de los límites en el DOM.
        // Como no podemos modificar el HTML para añadir spans con IDs específicos,
        // esta parte del código se omite. Los límites se aplicarán internamente,
        // pero no habrá una indicación visual directa en el HTML de la hoja.
        this.attributeInputs.forEach(inputObj => {
            if (inputObj.inputElement) {
                // Si tuvieras un elemento para mostrar el límite, lo actualizarías aquí.
                // Por ejemplo:
                // const limitDisplayElement = inputObj.inputElement.parentNode.querySelector('.limit-display');
                // if (limitDisplayElement) {
                //     limitDisplayElement.textContent = `(Max: ${inputObj.currentLimit})`;
                // }
            }
        });
    }

    // ***********************************************************************************
    // FIN DE LÓGICA DE LÍMITES DE ATRIBUTOS DINÁMICOS
    // ***********************************************************************************
}

/**
 * Extends the ItemSheet class from Foundry VTT to create a custom item sheet.
 */
class YokaiHunterItemSheet extends foundry.appv1.sheets.ItemSheet { // Usar la ruta con espacio de nombres

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
            height: 395,
            resizable: true,
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
class YokaiNPCSheet extends foundry.appv1.sheets.ActorSheet { // Usar la ruta con espacio de nombres
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
            height: 650,
            resizable: true,
            scrollY: [".sheet-body"],
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
            name: game.i18n.localize("YOKAIHUNTERSSOCIETY.NewItem"), // Usar la función de localización de Foundry
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
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ErrorOpeningSheet").replace("{item}", item?.name || 'el item')); // Usar la función de localización de Foundry
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
            ui.notifications.error(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemNotFound")); // Usar la función de localización de Foundry
            return;
        }

        // Custom confirmation dialog
        new Dialog({
            title: game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionTitle"), // Usar la función de localización de Foundry
            content: `<p>${game.i18n.localize("YOKAIHUNTERSSOCIETY.ConfirmDeletionMessage").replace("{item}", item.name)}</p>`, // Usar la función de localización de Foundry
            buttons: {
                yes: {
                    icon: '<i class="fas fa-trash"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Delete"), // Usar la función de localización de Foundry
                    callback: async () => {
                        await this.actor.deleteEmbeddedDocuments("Item", [itemId]);
                        ui.notifications.info(game.i18n.localize("YOKAIHUNTERSSOCIETY.ItemDeleted").replace("{item}", item.name)); // Usar la función de localización de Foundry
                    }
                },
                no: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("YOKAIHUNTERSSOCIETY.Cancel") // Usar la función de localización de Foundry
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
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning")); // Usar la función de localización de Foundry
            }
        }

        // Current health value should not exceed maximum health.
        if (typeof changed.system?.health?.value === 'number') {
            // Get the *new* max health if it's being changed in this update, otherwise use current actor's max health.
            const effectiveMaxHealth = changed.system.health.max ?? (this.actor.system.health?.max ?? 0);
            const newHealthValue = changed.system.health.value;

            if (newHealthValue > effectiveMaxHealth) {
                changed.system.health.value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning")); // Usar la función de localización de Foundry
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
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.MaxHealthCapWarning")); // Usar la función de localización de Foundry
            }
            // If max health changes, ensure current health doesn't exceed the new max.
            const currentHealthValue = this.actor.system.health?.value ?? 0;
            if (currentHealthValue > value) {
                const currentHealthInput = this.element.find('input[name="system.health.value"]');
                if (currentHealthInput.length) {
                    currentHealthInput.val(value);
                }
                foundry.utils.setProperty(change, "system.health.value", value);
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning")); // Usar la función de localización de Foundry
            }
            input.value = value;
        } else if (fieldName === "system.health.value") {
            const effectiveMaxHealth = (change.system?.health?.max !== undefined) ? change.system.max : (this.actor.system.health?.max ?? 0);
            if (value > effectiveMaxHealth) {
                value = effectiveMaxHealth;
                ui.notifications.warn(game.i18n.localize("YOKAIHUNTERSSOCIETY.HealthCapWarning")); // Usar la función de localización de Foundry
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
    // Usar las referencias con espacio de nombres
    foundry.documents.collections.Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
    foundry.documents.collections.Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);

    // Register the custom character sheet for 'hunter' actors.
    foundry.documents.collections.Actors.registerSheet("yokai-hunters-society", YokaiHunterSheet, {
        types: ["hunter"],
        makeDefault: true,
        label: "Yokai Hunters Society Sheet"
    });

    // Register the custom NPC/Yokai sheet for 'npcYokai' actors.
    foundry.documents.collections.Actors.registerSheet("yokai-hunters-society", YokaiNPCSheet, {
        types: ["npcYokai"],
        makeDefault: false,
        label: "NPC/Yokai Sheet"
    });

    // Register the custom item sheet for 'equipment' and 'gear' types.
    foundry.documents.collections.Items.registerSheet("yokai-hunters-society", YokaiHunterItemSheet, {
        types: ["equipment", "gear"],
        makeDefault: true,
        label: "Yokai Hunters Society Item Sheet"
    });

    // Register the custom item sheet for the 'movimiento' type, reusing the same sheet class.
    foundry.documents.collections.Items.registerSheet("yokai-hunters-society", YokaiHunterItemSheet, {
        types: ["movimiento"],
        makeDefault: false,
        label: "Movimiento Sheet"
    });

    // Define global configuration for localization.
    // CONFIG.YOKAIHUNTERSSOCIETY se inicializa aquí. game.i18n.localize se usará directamente.
    CONFIG.YOKAIHUNTERSSOCIETY = {};
});

// Hook para establecer la resistencia a la maldición por defecto para los nuevos actores "hunter" antes de la creación.
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
