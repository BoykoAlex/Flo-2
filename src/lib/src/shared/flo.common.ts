import { dia } from 'jointjs';

export namespace Flo {

  export enum DnDEventType {
    DRAG,
    DROP
  }

  export interface DnDEvent {
    type : DnDEventType;
    view : dia.CellView;
    event : MouseEvent;
  }

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
    [propName : string] : any; //TODO: is anything else needed?
  }

  export interface Metamodel {
    textToGraph(flo : EditorContext, definition: Definition) : void;
    graphToText(flo : EditorContext, definition: Definition) : void;
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
    createNode?(metadata : ElementMetadata, props : Map<string, any>) : dia.Element;
    createLink?(source : LinkEnd, target : LinkEnd, metadata : ElementMetadata, props : Map<string, any>) : dia.Link;
    createHandle?(kind : string, parent : dia.Cell) : dia.Element;
    createDecoration?(kind : string, parent : dia.Cell) : dia.Element;
    initializeNewNode?(node : dia.Element, viewerDescriptor : ViewerDescriptor) : void;
    initializeNewLink?(link : dia.Link, viewerDescriptor : ViewerDescriptor) : void;
    initializeNewHandle?(handle : dia.Element, viewerDescriptor : ViewerDescriptor) : void;
    initializeNewDecoration?(decoration : dia.Element, viewerDescriptor : ViewerDescriptor) : void;
    getNodeView?() : dia.ElementView;
    getLinkView?() : dia.LinkView;
    layout?(paper : dia.Paper) : Promise<any>;
    handleLinkEvent?(paper : dia.Paper, event : string, link : dia.Link) : void;
    isSemanticProperty?(propertyPath : string, element : dia.Cell) : boolean;
    refreshVisuals?(cell : dia.Cell, propertyPath : string, paper : dia.Paper) : void;
    getLinkAnchorPoint?(linkView : dia.LinkView, view : dia.ElementView, port : SVGElement, reference : dia.Point) : dia.Point;
  }

  export interface EditorContext {
    zoomPercent : number;
    gridSize : number;
    readOnlyCanvas : boolean;
    selection : dia.CellView;
    graphToTextSync : boolean;
    noPalette : boolean;
    scheduleGraphUpdate() : void;
    updateGraph() : void;
    updateText() : void;
    performLayout() : Promise<void>;
    clearGraph() : void;
    getGraph() : dia.Graph;
    getPaper() : dia.Paper;
    getMinZoom() : number;
    getMaxZoom() : number;
    getZoomStep() : number;
    fitToPage() : void;
    createNode(metadata : ElementMetadata, props : Map<string, any>, position : dia.Point) : dia.Element;
    createLink(source : LinkEnd, target : LinkEnd, metadata : ElementMetadata, props : Map<string, any>) : dia.Link;
    deleteSelectedNode() : void;
    postValidation() : void;
  }

  export interface LinkEndDescriptor {
    view : dia.CellView;
    cssClassSelector? : string;
  }

  export interface DnDDescriptor {
    context? : string;
    range?: number;
    source? : LinkEndDescriptor;
    target? : LinkEndDescriptor;
  }

  export interface LinkEnd {
    id : string;
    selector? : string;
    port? : string;
  }

  export enum Severity {
    Error,
    Warning
  }

  export interface Marker {
    severity : Severity;
    message : string;
    range? : any;
  }

  export interface Editor {
    interactive? : ((cellView: dia.CellView, event: string) => boolean) | boolean | { vertexAdd?: boolean, vertexMove?: boolean, vertexRemove?: boolean, arrowheadMove?: boolean };
    allowLinkVertexEdit? : boolean;
    highlighting? : any;
    createHandles?(context : EditorContext, createHandle : (owner : dia.CellView, kind : string, action : () => void, location : dia.Point) => void, owner : dia.CellView) : void;
    validatePort?(context : EditorContext, view : dia.ElementView, magnet : SVGElement) : boolean;
    validateLink?(context : EditorContext, cellViewS : dia.ElementView, portS : SVGElement, cellViewT : dia.ElementView, portT : SVGElement, isSource : boolean, linkView : dia.LinkView) : boolean;
    calculateDragDescriptor?(context : EditorContext, draggedView : dia.CellView, targetUnderMouse : dia.CellView, coordinate : dia.Point, sourceComponent : string) : DnDDescriptor;
    handleNodeDropping?(context : EditorContext, dragDescriptor : DnDDescriptor) : void;
    showDragFeedback?(context : EditorContext, dragDescriptor : DnDDescriptor) : void;
    hideDragFeedback?(context : EditorContext, dragDescriptor : DnDDescriptor) : void;
    validate?(graph : dia.Graph) : Promise<Map<string, Array<Marker>>>;
    preDelete?(context : EditorContext, deletedElement : dia.Cell) : void;
    setDefaultContent?(editorContext : EditorContext, data : Map<string, Map<string, ElementMetadata>>) : void;
  }

  export function findMagnetByClass(view : dia.CellView, className : string) : HTMLElement {
    if (className && className.startsWith('.')) {
      className = className.substr(1);
    }
    return view.$('[magnet]').toArray().find(magnet => magnet.getAttribute('class').split(/\s+/).indexOf(className) >= 0);
  }

  export function findMagnetByPort(view : dia.CellView, port : string) : HTMLElement {
    return view.$('[magnet]').toArray().find(magnet => magnet.getAttribute('port') === port);
  }

}




