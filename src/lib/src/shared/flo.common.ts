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

  export interface ViewerDescriptor {
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
    textToGraph(flo : ViewerDescriptor, definition: Definition) : void;
    graphToText(flo : ViewerDescriptor, definition: Definition) : void;
    load() : Promise<Map<string, Map<string, ElementMetadata>>>;
    groups() : Array<string>;

    refresh?() : Promise<Map<string, Map<string, ElementMetadata>>>;
    subscribe?(listener : MetamodelListener) : void;
    unsubscribe?(listener : MetamodelListener) : void;
    encodeTextToDSL?(text : string) : string;
    decodeTextFromDSL?(dsl : string) : string;
    isValidPropertyValue?(element : dia.Element, property : string, value : any) : boolean;
  }

  export interface CreationParams {
    metadata? : ElementMetadata;
    props? : Map<string, any>;
  }

  export interface ElementCreationParams extends CreationParams {
    position? : dia.Point;
  }

  export interface LinkCreationParams extends CreationParams {
    source : string;
    target : string;
  }

  export interface EmbeddedChildCreationParams extends CreationParams {
    parent : dia.Cell;
    position? : dia.Point;
  }

  export interface DecorationCreationParams extends EmbeddedChildCreationParams {
    kind : string;
    messages : Array<string>;
  }

  export interface HandleCreationParams extends EmbeddedChildCreationParams {
    kind : string;
  }

  export interface Renderer {
    createNode?(params : CreationParams) : dia.Element;
    createLink?(params : LinkCreationParams) : dia.Link;
    createHandle?(params : HandleCreationParams) : dia.Element;
    createDecoration?(params : DecorationCreationParams) : dia.Element;
    initializeNewNode?(node : dia.Element, viewerDescriptor : ViewerDescriptor) : void;
    initializeNewLink?(link : dia.Link, viewerDescriptor : ViewerDescriptor) : void;
    initializeNewHandle?(handle : dia.Element, viewerDescriptor : ViewerDescriptor) : void;
    initializeNewDecoration?(decoration : dia.Element, viewerDescriptor : ViewerDescriptor) : void;
    getNodeView?() : dia.ElementView;
    getLinkView?() : dia.LinkView;
    layout?(paper : dia.Paper) : void;
    handleLinkEvent?(paper : dia.Paper, event : string, link : dia.Link) : void;
    isSemanticProperty?(propertyPath : string, element : dia.Cell) : boolean;
    refreshVisuals?(cell : dia.Cell, propertyPath : string, paper : dia.Paper) : void;
    getLinkAnchorPoint?(linkView : dia.LinkView, view : dia.ElementView, port : SVGElement, reference : dia.Point) : dia.Point;
  }

  export interface EditorContext {
    zoomPercent : number;
    gridSize : number;
    readOnlyCanvas : boolean;
    scheduleGraphUpdate() : void;
    updateGraph() : void;
    updateText() : void;
    performLayout() : void;
    clearGraph() : void;
    getGraph() : dia.Graph;
    getPaper() : dia.Paper;
    enableSyncing(enable : boolean) : void;
    getSelection() : dia.CellView;
    getMinZoom() : number;
    getMaxZoom() : number;
    getZoomStep() : number;
    fitToPage() : void;
    createNode(params : ElementCreationParams) : dia.Element;
    createLink(params : LinkCreationParams) : dia.Link;
  }

  export interface LinkEndDescriptor {
    view : dia.ElementView;
    selector? : dia.CSSSelector;
  }

  export interface DnDDescriptor {
    context? : string;
    source? : LinkEndDescriptor;
    target? : LinkEndDescriptor;
  }

  export enum Severity {
    Error,
    Warning
  }

  export interface Marker {
    owner : dia.Cell;
    severity : Severity;
    message : string;
  }

  export interface Editor {
    interactive? : ((cellView: dia.CellView, event: string) => boolean) | boolean | { vertexAdd?: boolean, vertexMove?: boolean, vertexRemove?: boolean, arrowheadMove?: boolean };
    allowLinkVertexEdit? : boolean;
    createHandles?(context : EditorContext, createHandle : (owner : dia.CellView, kind : string, action : () => void, location : dia.Point) => void, owner : dia.CellView) : void;
    validatePort?(paper : dia.Paper, view : dia.ElementView, magnet : SVGElement) : boolean;
    validateLink?(context : EditorContext, cellViewS : dia.ElementView, portS : SVGElement, cellViewT : dia.ElementView, portT : SVGElement, isSource : boolean, linkView : dia.LinkView) : boolean;
    calculateDragDescriptor?(context : EditorContext, draggedView : dia.ElementView, targetUnderMouse : dia.Cell, coordinate : dia.Point, sourceComponent : string) : DnDDescriptor;
    handleNodeDropping?(context : EditorContext, dragDescriptor : DnDDescriptor) : void;
    showDragFeedback?(context : EditorContext, dragDescriptor : DnDDescriptor) : void;
    hideDragFeedback?(context : EditorContext, dragDescriptor : DnDDescriptor) : void;
    validate?(paper : dia.Paper) : Promise<Array<Marker>>;
    preDelete?(context : EditorContext, deletedElement : dia.Cell) : void;
  }

}




