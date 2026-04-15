/**
 * Shared schema for all Actors in Yokai Hunters Society.
 */
class BaseActorData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            age: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
            look: new fields.StringField({ initial: "" }),
            background: new fields.StringField({ initial: "" }),
            curseResistance: new fields.SchemaField({
                "1": new fields.BooleanField({ initial: false }),
                "2": new fields.BooleanField({ initial: false }),
                "3": new fields.BooleanField({ initial: false }),
                "4": new fields.BooleanField({ initial: false })
            }),
            attributes: new fields.SchemaField({
                courage: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, integer: true }) }),
                selfControl: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, integer: true }) }),
                wisdom: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, integer: true }) }),
                sharpness: new fields.SchemaField({ value: new fields.NumberField({ initial: 0, integer: true }) })
            }),
            health: new fields.SchemaField({
                value: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
                max: new fields.NumberField({ initial: 0, integer: true, min: 0, max: 15 })
            }),
            money: new fields.NumberField({ initial: 0, integer: true, min: 0 })
        };
    }
}

export class HunterData extends BaseActorData {}

export class NPCYokaiData extends BaseActorData {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            ...super.defineSchema(),
            description: new fields.StringField({ initial: "" }),
            level: new fields.NumberField({ initial: 0, integer: true, min: 0 }),
            movimientos: new fields.ArrayField(new fields.ObjectField(), { initial: [] })
        };
    }
}

/**
 * Shared schema for all Items.
 */
class BaseItemData extends foundry.abstract.TypeDataModel {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            description: new fields.HTMLField({ initial: "" }),
            bonus: new fields.NumberField({ initial: 0, integer: true })
        };
    }
}

export class EquipmentData extends BaseItemData {}
export class GearData extends BaseItemData {}
export class MovimientoData extends BaseItemData {
    static defineSchema() {
        const fields = foundry.data.fields;
        return {
            ...super.defineSchema(),
            // Movimientos in template.json had a redundant 'system' nesting, 
            // we flatten it here for better practice.
        };
    }
}