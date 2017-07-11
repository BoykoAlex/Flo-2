import { dia } from 'jointjs';

export namespace Flo {

  export interface PropertyMetadata {
    readonly id : string;
    readonly name : string;
    readonly description? : string;
    readonly defaultValue? : any;
    readonly [propName : string] : any;
  }

  export interface ExtraMetadata {
    readonly titleProperty : string;
    readonly noEditableProps : boolean;
    readonly noPaletteEntry : boolean;
    readonly [propName : string] : any;

    readonly allowAdditionalProperties : boolean; //TODO: Verify it is still needed
  }

  export interface ElementMetadata {
    readonly name : string;
    readonly group : string;
    description() : Promise<string>;
    get(property : String) : Promise<PropertyMetadata>;

    readonly metadata? : ExtraMetadata;
  }

  export interface EditorDescriptor {
    readonly graph : dia.Graph;
    readonly paper? : dia.Paper;
  }

  export interface MetamodelListener {
    metadataError(data : any) : void;
    metadataAboutToChange() : void;
    metadataChanged(data : MetadataChangedData) : void;
  }

  export interface MetadataChangedData {
    readonly old : Map<string, Map<string, ElementMetadata>>;
    readonly new : Map<string, Map<string, ElementMetadata>>;
    readonly [propName : string] : any;
  }

  export interface Definition {
    text : string;
    name? : string; //TODO: is this still required?
    [propName : string] : any; //TODO: is anything lese needed?
  }

  export interface Metamodel {
    textToGraph(flo : EditorDescriptor, definition: Definition) : void;
    graphToText(flo : EditorDescriptor, definition: Definition) : void;
    load() : Promise<Map<string, Map<string, ElementMetadata>>>;
    groups() : Array<string>;

    refresh?() : Promise<Map<string, Map<string, ElementMetadata>>>;
    subscribe?(listener : MetamodelListener) : void;
    unsubscribe?(listener : MetamodelListener) : void;
    encodeTextToDSL?(text : string) : string;
    decodeTextFromDSL?(dsl : string) : string;
    isValidPropertyValue?(element : dia.Element, property : string, value : any) : boolean;
  }

}




