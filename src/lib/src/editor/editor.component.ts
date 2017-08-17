import { Component, Input, Output, ElementRef, EventEmitter, OnInit, OnDestroy, ViewEncapsulation, OnChanges, SimpleChanges} from '@angular/core';
import { NgIf } from '@angular/common';
import { NgModel } from '@angular/forms';
import 'rxjs/add/operator/debounceTime';
import { dia } from 'jointjs';
import { Flo } from './../shared/flo.common';
import { Shapes, Constants } from '../shared/shapes';
import { Utils } from './editor.utils';
const joint = require('jointjs');
const $ = require('jquery');
const _ = require('lodash');
const { CompositeDisposable, Disposable } = require('rx');


export interface VisibilityState {
  visibility : string;
  children : Array<VisibilityState>;
}

const isChrome = true/*!!window.chrome*/;
const isFF = false/*typeof window.InstallTrigger !== 'undefined'*/;

@Component({
  selector: 'flo-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./../../../../node_modules/jointjs/dist/joint.css', './../shared/flo.css'],
  encapsulation: ViewEncapsulation.None
})
export class EditorComponent implements OnInit, OnDestroy, OnChanges {

  /**
   * Metamodel. Retrieves metadata about elements that can be shown in Flo
   */
  @Input()
  private metamodel: Flo.Metamodel;

  /**
   * Renders elements.
   */
  @Input()
  private renderer: Flo.Renderer;

  /**
   * Editor. Provides domain specific editing capabilities on top of standard Flo features
   */
  @Input()
  private editor: Flo.Editor;

  /**
   * Size (Width) of the palette
   */
  @Input()
  private paletteSize: number;

  /**
   * Min zoom percent value
   */
  @Input()
  private minZoom: number = 5;

  /**
   * Max zoom percent value
   */
  @Input()
  private maxZoom: number = 400;

  /**
   * Zoom percent increment/decrement step
   */
  @Input()
  private zoomStep: number = 5;

  @Input()
  private paperPadding : number = 0;

  @Output()
  floApi = new EventEmitter<Flo.EditorContext>();

  /**
   * Joint JS Graph object representing the Graph model
   */
  private graph: dia.Graph;

  /**
   * Joint JS Paper object representing the canvas control containing the graph view
   */
  private paper: dia.Paper;

  /**
   * Currently selected element
   */
  private _selection: dia.CellView;

  /**
   * Current DnD descriptor for frag in progress
   */
  private highlighted: Flo.DnDDescriptor;

  /**
   * Flag specifying whether the Flo-Editor is in read-only mode.
   */
  private _readOnlyCanvas: boolean = false;

  /**
   * Grid size
   */
  private _gridSize: number = 1;

  private _hiddenPalette : boolean = false;

  private editorContext : Flo.EditorContext;

  private _resizeHandler = () => this.autosizePaper();

  private textToGraphEventEmitter = new EventEmitter<void>();

  private graphToTextEventEmitter = new EventEmitter<void>();

  private _graphToTextSyncEnabled = true;

  private validationEventEmitter = new EventEmitter<void>();

  private _disposables = new CompositeDisposable();

  /* DSL Fields */

  private _dslText : string = '';

  @Output()
  private dslChanged = new EventEmitter<string>();

  constructor(private element: ElementRef) {
    let self = this;
    this.editorContext = new (class DefaultRunnableContext implements Flo.EditorContext {

      set zoomPercent(percent : number) {
        self.zoomPercent = percent;
      }

      get zoomPercent() : number {
        return self.zoomPercent;
      }

      set noPalette(noPalette : boolean) {
        self.noPalette = noPalette;
      }

      get noPalette() : boolean {
        return self.noPalette;
      }

      set gridSize(gridSize : number) {
        self.gridSize = gridSize;
      }

      get gridSize() : number {
        return self.gridSize;
      }

      set readOnlyCanvas(readOnly : boolean) {
        self.readOnlyCanvas = readOnly;
      }

      get readOnlyCanvas() : boolean {
        return self.readOnlyCanvas;
      }

      setDsl(dsl : string) {
        self.dsl = dsl;
      }

      updateGraph() : void {
        self.updateGraphRepresentation();
      }

      updateText() : void {
        self.updateTextRepresentation();
      }

      performLayout() : Promise<void> {
        return self.doLayout();
      }

      clearGraph() {
        self.selection = null;
        self.graph.clear();
        if (self.metamodel && self.metamodel.load && self.editor && self.editor.setDefaultContent) {
          return self.metamodel.load().then(data => self.editor.setDefaultContent(this, data));
        }
      }

      getGraph() {
        return self.graph;
      }

      getPaper() {
        return self.paper;
      }

      get graphToTextSync() : boolean {
        return self.graphToTextSync;
      }

      set graphToTextSync(sync : boolean) {
        self.graphToTextSync = sync;
      }

      getMinZoom() {
        return self.minZoom;
      }

      getMaxZoom() {
        return self.maxZoom;
      }

      getZoomStep() {
        return self.zoomStep;
      }

      fitToPage() {
        self.fitToPage();
      }

      createNode(metadata : Flo.ElementMetadata, props : Map<string, any>, position : dia.Point) : dia.Element {
        return self.createNode(metadata, props, position);
      }

      createLink(source : Flo.LinkEnd, target : Flo.LinkEnd, metadata : Flo.ElementMetadata, props : Map<string, any>) : dia.Link {
        return self.createLink(source, target, metadata, props);
      }

      get selection() : dia.CellView {
        return self.selection;
      }

      set selection(newSelection : dia.CellView) {
        self.selection = newSelection;
      }

      deleteSelectedNode() : void {
        if (self.selection) {
          if (self.editor && self.editor.preDelete) {
            self.editor.preDelete(self.editorContext, self.selection.model);
          } else {
            if (self.selection.model instanceof joint.dia.Element) {
              self.graph.getConnectedLinks(self.selection.model).forEach(function(l) {
                l.remove();
              });
            }
          }
          self.selection.model.remove();
          self.selection = null;
        }
      }

      postValidation() {
        self.postValidation();
      }

    })();
  }

  ngOnInit() {
    console.log('Initializing my component');

    this.initGraph();

    this.initPaper();

    this.initGraphListeners();

    this.initPaperListeners();

    this.initMetamodel();

    $(window).on('resize', this._resizeHandler);
    this._disposables.add(Disposable.create(() => $(window).off('resize', this._resizeHandler)));

    /*
     * Execute resize to get the right size for the SVG element on the editor canvas.
     * Executed via timeout to let angular render the DOM first and elements to have the right width and height
     */
    window.setTimeout(this._resizeHandler);

    this.floApi.emit(this.editorContext);

  }

  ngOnDestroy() {
    this._disposables.dispose();
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('Something changes');
  }

  get noPalette() : boolean {
    return this._hiddenPalette;
  }

  set noPalette(hidden : boolean) {
    this._hiddenPalette = hidden;
    // If palette is not shown ensure that canvas starts from the left==0!
    if (hidden) {
      $('#paper-container', this.element.nativeElement).css('left', 0);
    }
  }

  get graphToTextSync() : boolean {
    return this._graphToTextSyncEnabled;
  }

  set graphToTextSync(sync : boolean) {
    this._graphToTextSyncEnabled = sync;
    this.graphToTextEventEmitter.emit();
  }

  createHandle(element: dia.CellView, kind: string, action: () => void, location: dia.Point): dia.Element {
    if (!location) {
      let bbox: any = (<any>element.model).getBBox();
      location = bbox.origin().offset(bbox.width / 2, bbox.height / 2);
    }
    let handle = Shapes.Factory.createHandle({
      renderer: this.renderer,
      paper: this.paper,
      parent: element.model,
      kind: kind,
      position: location
    });
    let view = this.paper.findViewByModel(handle);
    view.on('cell:pointerdown', () => {
      if (action) {
        action();
      }
    });
    view.on('cell:mouseover', () => {
      handle.attr('image/filter', {
        name: 'dropShadow',
        args: {dx: 1, dy: 1, blur: 1, color: 'black'}
      });
    });
    view.on('cell:mouseout', () => {
      handle.removeAttr('image/filter');
    });

    // TODO: Look for ways to incorporate this option on the view when it's created
    (<any>view).options.interactive = false;

    return handle;
  }

  removeEmbeddedChildrenOfType(element: dia.Cell, types: Array<string>): void {
    let embeds = element.getEmbeddedCells();
    for (let i = 0; i < embeds.length; i++) {
      if (types.indexOf(embeds[i].get('type')) >= 0) {
        embeds[i].remove();
      }
    }
  }

  get selection() : dia.CellView {
    return this._selection;
  }

  set selection(newSelection: dia.CellView) {
    if (newSelection && (newSelection.model.get('type') === joint.shapes.flo.DECORATION_TYPE || newSelection.model.get('type') === joint.shapes.flo.HANDLE_TYPE)) {
      newSelection = this.paper.findViewByModel(this.graph.getCell(newSelection.model.get('parent')));
    }
    if (newSelection && (!newSelection.model.attr('metadata') || newSelection.model.attr('metadata/metadata/unselectable'))) {
      newSelection = null;
    }
    if (newSelection === this._selection || (!newSelection && !this._selection)) {
      if (this._selection /*&& propsMgr*/) {
        // propsMgr.togglePropertiesView(selection);
      }
    }
    else {
      if (this._selection) {
        var elementview = this.paper.findViewByModel(this._selection.model);
        if (elementview) { // May have been removed from the graph
          this.removeEmbeddedChildrenOfType(elementview.model, joint.shapes.flo.HANDLE_TYPE);
          elementview.unhighlight();
        }
      }
      if (newSelection) {
        newSelection.highlight();
        if (this.editor && this.editor.createHandles) {
          this.editor.createHandles(this.editorContext, (owner: dia.CellView, kind: string, action: () => void, location: dia.Point) => this.createHandle(owner, kind, action, location), newSelection);
        }
      }
      this._selection = newSelection;
      $('#properties', this.element.nativeElement).css('display','block');
      // if (propsMgr) {
      //   propsMgr.updatePropertiesView(newSelection);
      // }
    }
  }

  get readOnlyCanvas() : boolean {
    return this._readOnlyCanvas;
  }

  set readOnlyCanvas(value : boolean) {
    if (this._readOnlyCanvas === value) {
      // Nothing to do
      return
    }

    if (value) {
      this.selection = null;
    }
    if (this.graph) {
      this.graph.getLinks().forEach((link) => {
        if (value) {
            link.attr('.link-tools/display', 'none');
            link.attr('.marker-vertices/display', 'none');
            link.attr('.connection-wrap/display', 'none');
          } else {
            link.removeAttr('.link-tools/display');
            if (this.editor && this.editor.allowLinkVertexEdit) {
              link.removeAttr('.marker-vertices/display');
            }
            link.removeAttr('.connection-wrap/display');
          }
        });
      }
    this._readOnlyCanvas = value;
  }

  // _findMagnetByClass(view : dia.CellView, className : string) : HTMLElement {
  //   if (className && className.startsWith('.')) {
  //       className = className.substr(1);
  //   }
  //   return view.$('[magnet]').toArray().find(function(magnet) {
  //     return magnet.getAttribute('class').split(/\s+/).indexOf(className) >= 0;
  //   });
  // }
  //

  /**
   * Displays graphical feedback for the drag and drop in progress based on current drag and drop descriptor object
   *
   * @param dragDescriptor DnD info object. Has on info on graph node being dragged (drag source) and what it is
   * being dragged over at the moment (drop target)
   */
  showDragFeedback(dragDescriptor : Flo.DnDDescriptor) : void {
    if (this.editor && this.editor.showDragFeedback) {
      this.editor.showDragFeedback(this.editorContext, dragDescriptor);
    } else {
      let magnet : HTMLElement;
      if (dragDescriptor.source && dragDescriptor.source.view) {
        joint.V(dragDescriptor.source.view.el).addClass('dnd-source-feedback');
        if (dragDescriptor.source.cssClassSelector) {
          magnet = Flo.findMagnetByClass(dragDescriptor.source.view, dragDescriptor.source.cssClassSelector);
          if (magnet) {
            joint.V(magnet).addClass('dnd-source-feedback');
          }
        }
      }
      if (dragDescriptor.target && dragDescriptor.target.view) {
        joint.V(dragDescriptor.target.view.el).addClass('dnd-target-feedback');
        if (dragDescriptor.target.cssClassSelector) {
          magnet = Flo.findMagnetByClass(dragDescriptor.target.view, dragDescriptor.target.cssClassSelector);
          if (magnet) {
            joint.V(magnet).addClass('dnd-target-feedback');
          }
        }
      }
    }
  }

  /**
   * Hides graphical feedback for the drag and drop in progress based on current drag and drop descriptor object
   *
   * @param dragDescriptor DnD info object. Has on info on graph node being dragged (drag source) and what it is
   * being dragged over at the moment (drop target)
   */
  hideDragFeedback(dragDescriptor : Flo.DnDDescriptor) : void {
    if (this.editor && this.editor.hideDragFeedback) {
      this.editor.hideDragFeedback(this.editorContext, dragDescriptor);
    } else {
      let magnet : HTMLElement;
      if (dragDescriptor.source && dragDescriptor.source.view) {
        joint.V(dragDescriptor.source.view.el).removeClass('dnd-source-feedback');
        if (dragDescriptor.source.cssClassSelector) {
          magnet = Flo.findMagnetByClass(dragDescriptor.source.view, dragDescriptor.source.cssClassSelector);
          if (magnet) {
            joint.V(magnet).removeClass('dnd-source-feedback');
          }
        }
      }
      if (dragDescriptor.target && dragDescriptor.target.view) {
        joint.V(dragDescriptor.target.view.el).removeClass('dnd-target-feedback');
        if (dragDescriptor.target.cssClassSelector) {
          magnet = Flo.findMagnetByClass(dragDescriptor.target.view, dragDescriptor.target.cssClassSelector);
          if (magnet) {
            joint.V(magnet).removeClass('dnd-target-feedback');
          }
        }
      }
    }
  }

  /**
   * Sets the new DnD info object - the descriptor for DnD
   *
   * @param dragDescriptor DnD info object. Has on info on graph node being dragged (drag source) and what it is
   * being dragged over at the moment (drop target)
   */
  setDragDescriptor(dragDescriptor : Flo.DnDDescriptor) : void {
    if (this.highlighted === dragDescriptor) {
      return;
    }
    if (this.highlighted && dragDescriptor && _.isEqual(this.highlighted.context, dragDescriptor.context)) {
      if (this.highlighted.source === dragDescriptor.source && this.highlighted.target === dragDescriptor.target) {
        return;
      }
      if (this.highlighted.source &&
        dragDescriptor.source &&
        this.highlighted.target &&
        dragDescriptor.target &&
        this.highlighted.source.view.model === dragDescriptor.source.view.model &&
        this.highlighted.source.cssClassSelector === dragDescriptor.source.cssClassSelector &&
        this.highlighted.target.view.model === dragDescriptor.target.view.model &&
        this.highlighted.target.cssClassSelector === dragDescriptor.target.cssClassSelector) {
        return;
      }
    }
    if (this.highlighted) {
      this.hideDragFeedback(this.highlighted);
    }
    this.highlighted = dragDescriptor;
    if (this.highlighted) {
      this.showDragFeedback(this.highlighted);
    }
  }

  /**
   * Handles DnD events when a node is being dragged over canvas
   *
   * @param draggedView The Joint JS view object being dragged
   * @param targetUnderMouse The Joint JS view under mouse cursor
   * @param x X coordinate of the mouse on the canvas
   * @param y Y coordinate of the mosue on the canvas
   * @param context DnD context (palette or canvas)
   */
  handleNodeDragging(draggedView : dia.CellView, targetUnderMouse : dia.CellView, x : number, y : number, sourceComponent : string) {
    if (this.editor && this.editor.calculateDragDescriptor) {
      this.setDragDescriptor(this.editor.calculateDragDescriptor(this.editorContext, draggedView, targetUnderMouse, joint.g.point(x, y), sourceComponent));
    }
  }

  /**
   * Handles DnD drop event when a node is being dragged and dropped on the main canvas
   */
  handleNodeDropping() {
    if (this.highlighted && this.editor && this.editor.handleNodeDropping) {
      this.editor.handleNodeDropping(this.editorContext, this.highlighted);
    }
    this.setDragDescriptor(null);
  }

  /**
   * Hides DOM Node (used to determine drop target DOM element)
   * @param domNode DOM node to hide
   * @returns {{visibility: *, children: Array}}
   * @private
   */
  private _hideNode(domNode : HTMLElement) : VisibilityState {
    let oldVisibility : VisibilityState = {
      visibility: domNode.style ? domNode.style.display : undefined,
      children: []
    };
    for (var i = 0; i < domNode.children.length; i++) {
      let node = domNode.children.item(i);
      if (node instanceof HTMLElement) {
        oldVisibility.children.push(this._hideNode(<HTMLElement> node));
      }
    }
    domNode.style.display = 'none';
    return oldVisibility;
  }

  /**
   * Restored DOM node original visibility (used to determine drop target DOM element)
   * @param domNode DOM node to restore visibility of
   * @param oldVisibility original visibility parameter
   * @private
   */
  _restoreNodeVisibility(domNode : HTMLElement, oldVisibility : VisibilityState) {
    if (domNode.style) {
      domNode.style.display = oldVisibility.visibility;
    }
    let j = 0;
    for (var i = 0; i < domNode.childNodes.length; i++) {
      if (j < oldVisibility.children.length) {
        let node= domNode.children.item(i);
        if (node instanceof HTMLElement) {
          this._restoreNodeVisibility(<HTMLElement> node, oldVisibility.children[j++]);
        }
      }
    }
  }

  /**
   * Unfortunately we can't just use event.target because often draggable shape on the canvas overlaps the target.
   * We can easily find the element(s) at location, but only nodes :-( Unclear how to find links at location
   * (bounding box of a link for testing is bad).
   * The result of that is that links can only be the drop target when dragging from the palette currently.
   * When DnDing shapes on the canvas drop target cannot be a link.
   *
   * Excluded views enables you to choose to filter some possible answers (useful in the case where elements are stacked
   * - e.g. Drag-n-Drop)
   */
  getTargetViewFromEvent(event : MouseEvent, x : number, y : number, excludeViews : Array<dia.CellView> = []) : dia.CellView {
    if (!x && !y) {
      let l = this.paper.snapToGrid({x: event.clientX, y: event.clientY});
      x = l.x;
      y = l.y;
    }

    // TODO: See if next code paragraph is needed. Most likely it's just code executed for nothing
    // let elements = this.graph.findModelsFromPoint(joint.g.point(x, y));
    // let underMouse = elements.find(e => !_.isUndefined(excludeViews.find(x => x === this.paper.findViewByModel(e))));
    // if (underMouse) {
    //   return underMouse;
    // }

    let oldVisibility = excludeViews.map(x => this._hideNode(x.el));
    let targetElement = document.elementFromPoint(event.clientX, event.clientY);
    excludeViews.forEach((excluded, i) => {
      this._restoreNodeVisibility(excluded.el, oldVisibility[i]);
    });
    return this.paper.findView(targetElement);
  }

  handleDnDFromPalette(dndEvent : Flo.DnDEvent) {
    switch (dndEvent.type) {
      case Flo.DnDEventType.DRAG:
        this.handleDragFromPalette(dndEvent);
        break;
      case Flo.DnDEventType.DROP:
        this.handleDropFromPalette(dndEvent);
        break;
      default:
        break;
    }
  }

  handleDragFromPalette(dnDEvent : Flo.DnDEvent) {
    console.log('Dragging from palette');
    if (dnDEvent.view && !this.readOnlyCanvas) {
      let location = this.paper.snapToGrid({x: dnDEvent.event.clientX, y: dnDEvent.event.clientY});
      this.handleNodeDragging(dnDEvent.view,  this.getTargetViewFromEvent(dnDEvent.event, location.x, location.y, [dnDEvent.view]), location.x, location.y, Constants.PALETTE_CONTEXT);
    }
  }

  createNode(metadata : Flo.ElementMetadata, props : Map<string, any>, position : dia.Point) : dia.Element {
    return Shapes.Factory.createNode({
      renderer: this.renderer,
      paper: this.paper,
      metadata: metadata,
      props: props,
      position: position
    });
  }

  createLink(source : Flo.LinkEnd, target : Flo.LinkEnd, metadata : Flo.ElementMetadata, props : Map<string, any>) : dia.Link {
    return Shapes.Factory.createLink({
      renderer: this.renderer,
      paper: this.paper,
      source: source,
      target: target,
      metadata: metadata,
      props: props
    });
  }

  handleDropFromPalette(event : Flo.DnDEvent) {
    let cellview = event.view;
    let evt = event.event;
    if (this.paper.el === evt.target || $.contains(this.paper.el, evt.target)) {
      if (this.readOnlyCanvas) {
        this.setDragDescriptor(null);
      } else {
        let metadata = cellview.model.attr('metadata');
        let props = cellview.model.attr('props');

        let position = this.paper.snapToGrid({x: evt.clientX, y: evt.clientY});
        /* Calculate target element before creating the new
         * element under mouse location. Otherwise target
         * element would be the newly created element because
         * it's under the mouse pointer
         */
        let targetElement = this.getTargetViewFromEvent(evt, position.x, position.y, [ event.view ]);
        let newNode = this.createNode(metadata, props, position);
        let newView = this.paper.findViewByModel(newNode);

        this.handleNodeDragging(newView, targetElement, position.x, position.y, Constants.PALETTE_CONTEXT);
        this.handleNodeDropping();
      }
    }
  }

  autosizePaper() : void {
    let scrollBarSize = 17;
    let parent = $('#paper', this.element.nativeElement);
    this.paper.fitToContent({
      padding: this.paperPadding,
      minWidth: parent.width() - scrollBarSize,
      minHeight: parent.height() - scrollBarSize,
    });
  }

  fitToPage() : void {
    let scrollBarSize = 17;
    let parent = $('#paper', this.element.nativeElement);
    let minScale = this.minZoom / 100;
    let maxScale = 2;
    this.paper.scaleContentToFit({
      padding: this.paperPadding,
      minScaleX: minScale,
      minScaleY: minScale,
      maxScaleX: maxScale,
      maxScaleY: maxScale,
      fittingBBox: {x: 0, y: 0, width: parent.width() - scrollBarSize, height: parent.height() - scrollBarSize}
    });
    /**
     * #scaleContentToFit() sets some weird origin for the paper, so autosize to get the better origin.
     * If origins are different a sudden jump would flash when shape started being dragged on the
     * canvas after #fitToPage() has been called
     */
    this.autosizePaper();
  }

  get zoomPercent() : number {
    return Math.round(joint.V(this.paper.viewport).scale().sx * 100);
  }

  set zoomPercent(percent : number) {
    if (!isNaN(percent)) {
      if (percent < this.minZoom) {
          percent = this.minZoom;
      } else if (percent >= this.maxZoom) {
        percent = this.maxZoom;
      } else {
        if (percent <= 0) {
          percent = 0.00001;
        }
      }
      this.paper.scale(percent/100, percent/100);
    }
  }

  get gridSize() : number {
    return this._gridSize;
  }

  set gridSize(size : number) {
    if (!isNaN(size) && size >= 1) {
      this._gridSize = size;
      if (this.paper) {
        this.paper.setGridSize(size);
      }
    }
  }

  validateGraph() : void {
    if (this.editor && this.editor.validate) {
      this.editor
        .validate(this.graph)
        .then(allMarkers => this.graph.getCells()
          .forEach(cell => this.markElement(cell, allMarkers.has(cell.id) ? allMarkers.get(cell.id) : [])));
    }
  }

  markElement(cell: dia.Cell, markers: Array<Flo.Marker>) {

    // TODO: Evaluate code commnted out below
    // errors.forEach(function(e) {
    //   if (typeof e === 'string') {
    //     errorMessages.push(e);
    //   } else if (typeof e.message === 'string') {
    //     if (e.range) {
    //       if (!$scope.definition.parseError) {
    //         $scope.definition.parseError = [];
    //       }
    //       $scope.definition.parseError.push(e);
    //     }
    //     errorMessages.push(e.message);
    //   }
    // });

    let errorMessages = markers.map(m => m.message);

    let errorCell = cell.getEmbeddedCells().find(e => e.attr('./kind') === Constants.ERROR_DECORATION_KIND);
    if (errorCell) {
      if (errorMessages.length === 0) {
        errorCell.remove();
      } else {
        // Without rewrite we merge this list with existing errors
        (<any>errorCell).attr('messages', errorMessages, {rewrite: true});
      }
    } else if (errorMessages.length > 0) {
      let error = Shapes.Factory.createDecoration({
        renderer: this.renderer,
        paper: this.paper,
        parent: cell,
        kind: Constants.ERROR_DECORATION_KIND,
        messages: errorMessages
      });
      let pt : dia.Point;
      if (cell instanceof joint.dia.Element) {
        pt = (<any>(<dia.Element> cell).getBBox()).topRight().offset(-error.get('size').width, 0);
      } else {
        // TODO: do something for the link perhaps?
      }
      error.set('position', pt);
      let view = this.paper.findViewByModel(error);

      // Cast to <any>. Types are missing 'options' property
      (<any>view).options.interactive = false;
    }
  }

  doLayout() : Promise<void> {
    if (this.renderer && this.renderer.layout) {
      return this.renderer.layout(this.paper);
    }
  }

  @Input()
  set dsl(dslText : string) {
    if (this._dslText !== dslText) {
      this._dslText = dslText;
      this.textToGraphEventEmitter.emit();
    }
  }

  get dsl() : string {
    return this._dslText;
  }

  /**
   * Ask the server to parse the supplied text into a JSON graph of nodes and links,
   * then update the view based on that new information.
   *
   * @param {string} definition A flow definition (could be any format the server 'parse' endpoint understands)
   */
  updateGraphRepresentation() {
    console.debug(`Updating graph to represent '${this._dslText}'`);
    if (this.metamodel && this.metamodel.textToGraph) {
      this.metamodel.textToGraph(this.editorContext, this._dslText);
    }
  }

  updateTextRepresentation() : void {
    if (this.metamodel && this.metamodel.graphToText) {
      this.metamodel.graphToText(this.editorContext).then(text => {
        if (this._dslText != text) {
          this._dslText = text;
          this.dslChanged.emit(text);
        }
      });
    }
  }

  initMetamodel() {
    this.metamodel.load().then(data => {
      this.updateGraphRepresentation();

      let textSyncSubscription = this.graphToTextEventEmitter.debounceTime(300).subscribe(() => {
        if (this._graphToTextSyncEnabled) {
          this.updateTextRepresentation();
        }
      });
      this._disposables.add(Disposable.create(() => textSyncSubscription.unsubscribe()));

      let validationSubscription = this.validationEventEmitter.debounceTime(300).subscribe(() => this.validateGraph());
      this._disposables.add(Disposable.create(() => validationSubscription.unsubscribe()));

      let graphSyncSubscription = this.textToGraphEventEmitter.debounceTime(300).subscribe(() => this.updateGraphRepresentation());
      this._disposables.add(Disposable.create(() => graphSyncSubscription.unsubscribe()));

      if (this.editor && this.editor.setDefaultContent) {
        this.editor.setDefaultContent(this.editorContext, data);
      }
    });
  }

  initGraph() {
    this.graph = new joint.dia.Graph();
    this.graph.attributes.type = joint.shapes.flo.CANVAS_TYPE;
  }

  postValidation() {
    console.log('Validation request posted');
    this.validationEventEmitter.emit();
  }

  handleNodeCreation(node : dia.Element) {
    node.on('change:size', this._resizeHandler);
    node.on('change:position', this._resizeHandler);
    if (node.attr('metadata')) {

      node.on('change:attrs', (cell : dia.Element, attrs : any, changeData : any) => {
        let propertyPath = changeData ? changeData.propertyPath : null;
        if (propertyPath) {
          let propAttr = propertyPath.substr(propertyPath.indexOf('/') + 1);
          if (propAttr.indexOf('metadata') === 0 ||
            propAttr.indexOf('props') === 0 ||
            (this.renderer && this.renderer.isSemanticProperty && this.renderer.isSemanticProperty(propAttr, node))) {
            this.postValidation();
            if (this.selection && this.selection.model === node) {
              // if (propsMgr) {
              //   propsMgr.updatePropertiesView(selection);
              // }
            }
            this.graphToTextEventEmitter.emit();
          }
          if (this.renderer && this.renderer.refreshVisuals) {
            this.renderer.refreshVisuals(node, propAttr, this.paper);
          }

        }
      });

      this.postValidation();
    }
  }

  /**
   * Forwards a link event occurrence to any handlers in the editor service, if they are defined. Event examples
   * are 'change:source', 'change:target'.
   */
  handleLinkEvent(event : string, link : dia.Link) {
    if (this.renderer && this.renderer.handleLinkEvent) {
      if (this.renderer.handleLinkEvent(this.paper, event, link)) {
        // If the link was changed, update the properties view which might be open for it
        // if (propsMgr && propsMgr.isVisible(link.id)) {
        //   propsMgr.updatePropertiesView(paper.findViewByModel(link));
        // }
      }
    }
  }

  handleLinkCreation(link : dia.Link) {
    this.handleLinkEvent('add', link);
    this.postValidation();

    link.on('change:source', (link : dia.Link) => {
      this.autosizePaper();
      let newSourceId = link.get('source').id;
      let oldSourceId = link.previous('source').id;
      if (newSourceId !== oldSourceId) {
        this.postValidation();
        this.graphToTextEventEmitter.emit();
      }
      this.handleLinkEvent('change:source', link);
    });

    link.on('change:target', (link : dia.Link) => {
      this.autosizePaper();
      let newTargetId = link.get('target').id;
      let oldTargetId = link.previous('target').id;
      if (newTargetId !== oldTargetId) {
        this.postValidation();
        this.graphToTextEventEmitter.emit();
      }
      this.handleLinkEvent('change:target', link);
    });

    link.on('change:vertices', this._resizeHandler);

    link.on('change:attrs', (cell : dia.Link, attrs : any, changeData : any) => {
      let propertyPath = changeData ? changeData.propertyPath : null;
      if (propertyPath) {
        let propAttr = propertyPath.substr(propertyPath.indexOf('/') + 1);
        if (propAttr.indexOf('metadata') === 0 ||
          propAttr.indexOf('props') === 0 ||
          (this.renderer && this.renderer.isSemanticProperty && this.renderer.isSemanticProperty(propAttr, link))) {
          let sourceId = link.get('source').id;
          let targetId = link.get('target').id;
          if (sourceId || targetId) {
            this.postValidation();
          }
          // if (this.selection && this.selection.model === link) {
          //   if (propsMgr) {
          //     propsMgr.updatePropertiesView(selection);
          //   }
          // }
          this.graphToTextEventEmitter.emit();
        }
        if (this.renderer && this.renderer.refreshVisuals) {
          this.renderer.refreshVisuals(link, propAttr, this.paper);
        }
      }
    });

    this.paper.findViewByModel(link).on('link:options', () => this.handleLinkEvent('options', link));

    if (this.readOnlyCanvas) {
      link.attr('.link-tools/display', 'none');
    }
  }

  initGraphListeners() {
    this.graph.on('add', (element : dia.Cell) => {
      if (element instanceof joint.dia.Link) {
        this.handleLinkCreation(<dia.Link> element);
      } else if (element instanceof joint.dia.Element) {
        this.handleNodeCreation(<dia.Element> element);
      }
      if (element.get('type') === joint.shapes.flo.NODE_TYPE || element.get('type') === joint.shapes.flo.LINK_TYPE) {
        this.graphToTextEventEmitter.emit();
      }
      this.autosizePaper();
    });

    this.graph.on('remove', (element : dia.Cell) => {
      if (element instanceof joint.dia.Link) {
        this.handleLinkEvent('remove', <dia.Link> element);
        this.postValidation();
      }
      if (this.selection && this.selection.model === element) {
        this.selection = null;
        // if (propsMgr) {
        //   propsMgr.updatePropertiesView();
        // }
      }
      if (element.isLink()) {
        window.setTimeout(() => this.graphToTextEventEmitter.emit(), 100);
      } else if (element.get('type') === joint.shapes.flo.NODE_TYPE) {
        this.graphToTextEventEmitter.emit();
      }
      this.autosizePaper();
    });

    // Set if link is fan-routed. Should be called before routing call
    this.graph.on('change:vertices', (link : dia.Link, changed : any, opt : any) => {
      if (opt.fanRouted) {
        link.set('fanRouted', true);
      } else {
        link.unset('fanRouted');
      }
    });
    // adjust vertices when a cell is removed or its source/target was changed
    this.graph.on('add remove change:source change:target change:vertices change:position', _.partial(Utils.fanRoute, this.graph));
  }

  initPaperListeners() {
    // http://stackoverflow.com/questions/20463533/how-to-add-an-onclick-event-to-a-joint-js-element
    this.paper.on('cell:pointerclick', (cellView : dia.CellView) => {
        if (!this.readOnlyCanvas) {
          this.selection = cellView;
        }
      }
    );

    this.paper.on('blank:pointerclick', () => {
      this.selection = null;
    });

    this.paper.on('scale', this._resizeHandler);

    this.paper.on('all', function() {
      if (Utils.isCustomPaperEvent(arguments)) {
        arguments[2].trigger.apply(arguments[2], [arguments[0], arguments[1], arguments[3], arguments[4]]);
      }
    });

    this.paper.on('dragging-node-over-canvas', (dndEvent : Flo.DnDEvent) => {
      console.log(`Canvas DnD type = ${dndEvent.type}`);
      let location = this.paper.snapToGrid({x: dndEvent.event.clientX, y: dndEvent.event.clientY});
      switch (dndEvent.type) {
        case Flo.DnDEventType.DRAG:
          this.handleNodeDragging(dndEvent.view, this.getTargetViewFromEvent(dndEvent.event, location.x, location.y, [ dndEvent.view ]), location.x, location.y, Constants.CANVAS_CONTEXT);
          break;
        case Flo.DnDEventType.DROP:
          this.handleNodeDropping();
          break;
        default:
          break;
      }
    });

    // JointJS now no longer grabs focus if working in a paper element - crude...
    $('#flow-view', this.element.nativeElement).on('mousedown', () => {
      $('#palette-filter-textfield', this.element.nativeElement).focus();
    });
  }

  initPaper() : void {

    let options : any = {
      el: $('#paper', this.element.nativeElement),
      gridSize: this._gridSize,
      drawGrid: true,
      model: this.graph,
      elementView: this.renderer && this.renderer.getNodeView ? this.renderer.getNodeView() : joint.shapes.flo.ElementView/*joint.dia.ElementView*/,
      linkView: this.renderer && this.renderer.getLinkView ? this.renderer.getLinkView() : joint.shapes.flo.LinkView,
      // Enable link snapping within 25px lookup radius
      snapLinks: { radius: 25 }, // http://www.jointjs.com/tutorial/ports
      defaultLink: /*this.renderer && this.renderer.createDefaultLink ? this.renderer.createDefaultLink : new joint.shapes.flo.Link*/
        (cellView: dia.ElementView, magnet: HTMLElement) => {
          if (this.renderer && this.renderer.createLink) {
            let linkEnd : Flo.LinkEnd = {
              id: cellView.model.id
            }
            if (magnet) {
              linkEnd.selector = cellView.getSelector(magnet, null);
            }
            if (magnet.getAttribute('port')) {
              linkEnd.port = magnet.getAttribute('port');
            }
            if (magnet.getAttribute('port') === 'input') {
              return this.renderer.createLink(null, linkEnd, null, null);
            } else {
              return this.renderer.createLink(linkEnd, null, null, null)
            }
          } else {
            return new joint.shapes.flo.Link();
          }
        },

      // decide whether to create a link if the user clicks a magnet
      validateMagnet: (cellView : dia.ElementView, magnet : SVGElement) => {
        if (this.readOnlyCanvas) {
          return false;
        } else {
          if (this.editor && this.editor.validatePort) {
            return this.editor.validatePort(this.editorContext, cellView, magnet);
          } else {
            return true;
          }
        }
      },

      interactive: () => {
        if (this.readOnlyCanvas) {
          return false;
        } else {
          return this.editor && this.editor.interactive ? this.editor.interactive : true;
        }
      },

      highlighting: this.editor && this.editor.highlighting ? this.editor.highlighting : {
          'default': {
            name: 'addClass',
            options: {
              className: 'highlighted'
            }
          }
        },

      markAvailable: true
    };

    if (this.renderer && this.renderer.getLinkAnchorPoint) {
      options.linkConnectionPoint = this.renderer.getLinkAnchorPoint;
    }

    if (this.editor && this.editor.validateLink) {
      options.validateConnection = (cellViewS : dia.ElementView, magnetS : SVGElement, cellViewT : dia.ElementView, magnetT : SVGElement, end : boolean, linkView : dia.LinkView) =>
        this.editor.validateLink(this.editorContext, cellViewS, magnetS, cellViewT, magnetT, end, linkView);
    }

    // The paper is what will represent the graph on the screen
    this.paper = new joint.dia.Paper(options);
  }

}
