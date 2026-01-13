import { Union, Record } from "../fable_modules/fable-library-js.4.27.0/Types.js";
import { union_type, record_type, string_type } from "../fable_modules/fable-library-js.4.27.0/Reflection.js";

export class T_PositionInfo extends Record {
    constructor(Name) {
        super();
        this.Name = Name;
    }
}

export function T_PositionInfo_$reflection() {
    return record_type("Types.T_PositionInfo", [], T_PositionInfo, () => [["Name", string_type]]);
}

export class T_Type extends Union {
    constructor(tag, fields) {
        super();
        this.tag = tag;
        this.fields = fields;
    }
    cases() {
        return ["T_Float", "T_Percent", "T_Dollar", "T_Bool", "T_Asset", "T_Position", "T_Instance", "T_Unit", "T_Error"];
    }
}

export function T_Type_$reflection() {
    return union_type("Types.T_Type", [], T_Type, () => [[], [], [], [], [], [["Item", T_PositionInfo_$reflection()]], [["Item", T_PositionInfo_$reflection()]], [], [["Item", string_type]]]);
}

