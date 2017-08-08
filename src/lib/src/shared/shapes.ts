import { dia } from '@types/jointjs';
import { Flo } from './flo.common';
import ElementCreationParams = Shapes.ElementCreationParams;
import EditorDescriptor = Flo.ViewerDescriptor;
const joint = require('jointjs');
const _ = require('underscore');

const isChrome : boolean = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
const isFF : boolean = navigator.userAgent.indexOf("Firefox") > 0;

const IMAGE_W : number = 120;
const IMAGE_H : number = 35;

const ERROR_MARKER_SIZE : dia.Size = {width: 16, height: 16};

const HANDLE_SIZE : dia.Size = {width: 10, height: 10};

joint.shapes.flo = {};

joint.shapes.flo.NODE_TYPE = 'sinspctr.IntNode';
joint.shapes.flo.LINK_TYPE = 'sinspctr.Link';
joint.shapes.flo.DECORATION_TYPE = 'decoration';
joint.shapes.flo.HANDLE_TYPE = 'handle';

joint.shapes.flo.CANVAS_TYPE = 'canvas';
joint.shapes.flo.PALETTE_TYPE = 'palette';
joint.shapes.flo.FEEDBACK_TYPE = 'feedback';

const HANDLE_ICON_MAP : Map<string, string>= new Map<string, string>();
HANDLE_ICON_MAP.set('remove', 'icons/delete.svg');

const DECORATION_ICON_MAP : Map<string, string>= new Map<string, string>();
DECORATION_ICON_MAP.set('error', 'icons/error.svg');

joint.util.filter.redscale = (args : Shapes.FilterOptions) => {

  let amount = _.isFinite(args.amount) ? args.amount : 1;

  return _.template('<filter><feColorMatrix type="matrix" values="${a} ${b} ${c} 0 ${d} ${e} ${f} ${g} 0 0 ${h} ${i} ${k} 0 0 0 0 0 1 0"/></filter>', {
    a: 1 - 0.96 * amount,
    b: 0.95 * amount,
    c: 0.01 * amount,
    d: 0.3 * amount,
    e: 0.2 * amount,
    f: 1 - 0.9 * amount,
    g: 0.7 * amount,
    h: 0.05 * amount,
    i: 0.05 * amount,
    k: 1 - 0.1 * amount
  });
};

joint.util.filter.orangescale = (args : Shapes.FilterOptions) => {

  let amount = _.isFinite(args.amount) ? args.amount : 1;

  return _.template('<filter><feColorMatrix type="matrix" values="${a} ${b} ${c} 0 ${d} ${e} ${f} ${g} 0 ${h} ${i} ${k} ${l} 0 0 0 0 0 1 0"/></filter>', {
    a: 1.0 + 0.5 * amount,
    b: 1.4 * amount,
    c: 0.2 * amount,
    d: 0.3 * amount,
    e: 0.3 * amount,
    f: 1 + 0.05 * amount,
    g: 0.2 * amount,
    h: 0.15 * amount,
    i: 0.3 * amount,
    k: 0.3 * amount,
    l: 1 - 0.6 * amount
  });
};

joint.shapes.flo.Node = joint.shapes.basic.Generic.extend({
  markup:
  '<g class="shape"><image class="image" /></g>'+
  '<rect class="border-white"/>' +
  '<rect class="border"/>' +
  '<rect class="box"/>'+
  '<text class="label"/>'+
  '<text class="label2"></text>'+
  '<rect class="input-port" />'+
  '<rect class="output-port"/>'+
  '<rect class="output-port-cover"/>',

  defaults: joint.util.deepSupplement({

    type: joint.shapes.flo.NODE_TYPE,
    position: {x: 0, y: 0},
    size: { width: IMAGE_W, height: IMAGE_H },
    attrs: {
      '.': { magnet: false },
      // rounded edges around image
      '.border': {
        width: IMAGE_W,
        height: IMAGE_H,
        rx: 3,
        ry: 3,
        'fill-opacity':0, // see through
        stroke: '#eeeeee',
        'stroke-width': 0
      },

      '.box': {
        width: IMAGE_W,
        height: IMAGE_H,
        rx: 3,
        ry: 3,
        //'fill-opacity':0, // see through
        stroke: '#6db33f',
        fill: '#eeeeee',
        'stroke-width': 1
      },
      '.input-port': {
        type: 'input',
        height: 8, width: 8,
        magnet: true,
        fill: '#eeeeee',
        transform: 'translate(' + -4 + ',' + ((IMAGE_H/2)-4) + ')',
        stroke: '#34302d',
        'stroke-width': 1
      },
      '.output-port': {
        type: 'output',
        height: 8, width: 8,
        magnet: true,
        fill: '#eeeeee',
        transform: 'translate(' + (IMAGE_W-4) + ',' + ((IMAGE_H/2)-4) + ')',
        stroke: '#34302d',
        'stroke-width': 1
      },
      '.label': {
        'text-anchor': 'middle',
        'ref-x': 0.5, // jointjs specific: relative position to ref'd element
        // 'ref-y': -12, // jointjs specific: relative position to ref'd element
        'ref-y': 0.3,
        ref: '.border', // jointjs specific: element for ref-x, ref-y
        fill: 'black',
        'font-size': 14
      },
      '.label2': {
        'text': '\u21d2',
        'text-anchor': 'middle',
        'ref-x': 0.15, // jointjs specific: relative position to ref'd element
        'ref-y': 0.15, // jointjs specific: relative position to ref'd element
        ref: '.border', // jointjs specific: element for ref-x, ref-y
        transform: 'translate(' + (IMAGE_W/2) + ',' + (IMAGE_H/2) + ')',
        fill: 'black',
        'font-size': 24
      },
      '.shape': {
      },
      '.image': {
        width: IMAGE_W,
        height: IMAGE_H
      }
    }
  }, joint.shapes.basic.Generic.prototype.defaults)
});


joint.shapes.flo.Link = joint.dia.Link.extend({
  defaults: joint.util.deepSupplement({
    type: joint.shapes.flo.LINK_TYPE,
    attrs: {
      '.connection': { stroke: '#34302d', 'stroke-width': 2 },
      // Lots of alternatives that have been played with:
//	            '.smoooth': true
//	            '.marker-source': { stroke: '#9B59B6', fill: '#9B59B6', d: 'M24.316,5.318,9.833,13.682,9.833,5.5,5.5,5.5,5.5,25.5,9.833,25.5,9.833,17.318,24.316,25.682z' },
//	            '.marker-target': { stroke: '#F39C12', fill: '#F39C12', d: 'M14.615,4.928c0.487-0.986,1.284-0.986,1.771,0l2.249,4.554c0.486,0.986,1.775,1.923,2.864,2.081l5.024,0.73c1.089,0.158,1.335,0.916,0.547,1.684l-3.636,3.544c-0.788,0.769-1.28,2.283-1.095,3.368l0.859,5.004c0.186,1.085-0.459,1.553-1.433,1.041l-4.495-2.363c-0.974-0.512-2.567-0.512-3.541,0l-4.495,2.363c-0.974,0.512-1.618,0.044-1.432-1.041l0.858-5.004c0.186-1.085-0.307-2.6-1.094-3.368L3.93,13.977c-0.788-0.768-0.542-1.525,0.547-1.684l5.026-0.73c1.088-0.158,2.377-1.095,2.864-2.081L14.615,4.928z' },
//	        	'.connection': { 'stroke':'black'},
//	        	'.': { filter: { name: 'dropShadow', args: { dx: 1, dy: 1, blur: 2 } } },
//	        	'.connection': { 'stroke-width': 10, 'stroke-linecap': 'round' },
      // This means: moveto 10 0, lineto 0 5, lineto, 10 10 closepath(z)
//	        	'.marker-target': { d: 'M 5 0 L 0 7 L 5 14 z', stroke: '#34302d','stroke-width' : 1},
//	        	'.marker-target': { d: 'M 14 2 L 9,2 L9,0 L 0,7 L 9,14 L 9,12 L 14,12 z', 'stroke-width' : 1, fill: '#34302d', stroke: '#34302d'},
//	        	'.marker-source': {d: 'M 5 0 L 5,10 L 0,10 L 0,0 z', 'stroke-width' : 0, fill: '#34302d', stroke: '#34302d'},
//	            '.marker-target': { stroke: '#E74C3C', fill: '#E74C3C', d: 'M 10 0 L 0 5 L 10 10 z' },
      '.marker-arrowheads': { display: 'none' },
      '.tool-options': { display: 'none' }
    },
//	    	connector: { name: 'normalDimFix' }
  }, joint.dia.Link.prototype.defaults)
});

joint.shapes.flo.ErrorDecoration = joint.shapes.basic.Generic.extend({

  markup: '<g class="rotatable"><g class="scalable"><image/></g></g>',

  defaults: joint.util.deepSupplement({

    type: joint.shapes.flo.DECORATION_TYPE,
    size: ERROR_MARKER_SIZE,
    attrs: {
      'image': ERROR_MARKER_SIZE
    }

  }, joint.shapes.basic.Generic.prototype.defaults)
});

export namespace Shapes {

  export interface CreationParams extends Flo.CreationParams {
    renderService? : any; // TODO: switch for the RenderService interface type later on
    paper? : dia.Paper;
    graph? : dia.Graph;
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

  export interface FilterOptions {
    amount : number;
    [propName : string] : any;
  }


  export class Factory {

    /**
     * Create a JointJS node that embeds extra metadata (properties).
     */
    static createNode(params : ElementCreationParams) : dia.Element {
      let renderService : any = params.renderService;
      let paper : dia.Paper = params.paper;
      let metadata : Flo.ElementMetadata = params.metadata;
      let position : dia.Point = params.position;
      let props : Map<string, any> = params.props;
      let graph : dia.Graph = params.graph || (params.paper ? params.paper.model : undefined);

      let node : dia.Element;
      if (!position) {
        position = {x: 0, y: 0};
      }

      if (renderService && _.isFunction(renderService.createNode)) {
        node = renderService.createNode(metadata, props);
      } else {
        node = new joint.shapes.flo.Node();
        node.attr('.label/text', metadata.name);
      }
      node.set('type', joint.shapes.flo.NODE_TYPE);
      node.set('position', position);
      node.attr('props', props);
      node.attr('metadata', metadata);
      if (graph) {
        graph.addCell(node);
      }
      if (renderService && _.isFunction(renderService.initializeNewNode)) {
        let descriptor : Flo.ViewerDescriptor = {
          paper: paper,
          graph: graph
        };
        renderService.initializeNewNode(node, descriptor);
      }
      return node;
    }

    static createLink(params : LinkCreationParams) : dia.Link {
      let renderService : any = params.renderService;
      let paper : dia.Paper = params.paper;
      let metadata : Flo.ElementMetadata = params.metadata;
      let source : string = params.source;
      let target : string = params.target;
      let props : Map<string, any> = params.props;
      let graph : dia.Graph= params.graph || (params.paper ? params.paper.model : undefined);

      let link : dia.Link;
      if (renderService && _.isFunction(renderService.createLink)) {
        link = renderService.createLink(source, target, metadata, props);
      } else {
        link = new joint.shapes.flo.Link();
      }
      link.set('source', source);
      link.set('target', target);
      link.set('type', joint.shapes.flo.LINK_TYPE);
      if (metadata) {
        link.attr('metadata', metadata);
      }
      link.attr('props', props);
      if (graph) {
        graph.addCell(link);
      }
      if (renderService && _.isFunction(renderService.initializeNewLink)) {
        let descriptor : Flo.ViewerDescriptor = {
          paper: paper,
          graph: graph
        };
        renderService.initializeNewLink(link, descriptor);
      }
      // prevent creation of link breaks
      link.attr('.marker-vertices/display', 'none');
      return link;
    }

    static createDecoration(params : DecorationCreationParams) : dia.Element {
      let renderService : any = params.renderService;
      let paper : dia.Paper = params.paper;
      let parent : dia.Cell = params.parent;
      let kind : string = params.kind;
      let messages : Array<string> = params.messages;
      let location : dia.Point = params.position;
      let graph : dia.Graph = params.graph || (params.paper ? params.paper.model : undefined);

      if (!location) {
        location = {x: 0, y: 0};
      }
      let decoration : dia.Element;
      if (renderService && _.isFunction(renderService.createDecoration)) {
        decoration = renderService.createDecoration(kind, parent);
      } else {
        decoration = new joint.shapes.flo.ErrorDecoration({
          attrs: {
            image: { 'xlink:href': DECORATION_ICON_MAP[kind] },
          }
        });
      }
      decoration.set('type', joint.shapes.flo.DECORATION_TYPE);
      decoration.set('position', location);
      if ((isChrome || isFF) && parent && typeof parent.get('z') === 'number') {
        decoration.set('z', parent.get('z') + 1);
      }
      decoration.attr('./kind', kind);
      decoration.attr('messages', messages);
      if (graph) {
        graph.addCell(decoration);
      }
      parent.embed(decoration);
      if (renderService && _.isFunction(renderService.initializeNewDecoration)) {
        let descriptor : Flo.ViewerDescriptor = {
          paper: paper,
          graph: graph
        };
        renderService.initializeNewDecoration(decoration, descriptor);
      }
      return decoration;
    }

    static createHandle(params : HandleCreationParams) : dia.Element {
      let renderService : any = params.renderService;
      let paper : dia.Paper = params.paper;
      let parent : dia.Cell = params.parent;
      let kind : string = params.kind;
      let location : dia.Point = params.position;
      let graph : dia.Graph = params.graph || (params.paper ? params.paper.model : undefined);

      let handle : dia.Element;
      if (!location) {
        location = {x: 0, y: 0};
      }
      if (renderService && _.isFunction(renderService.createHandle)) {
        handle = renderService.createHandle(kind, parent);
      } else {
        handle = new joint.shapes.flo.ErrorDecoration({
          size: HANDLE_SIZE,
          attrs: {
            'image': {
              'xlink:href': HANDLE_ICON_MAP[kind]
            }
          }
        });
      }
      handle.set('type', joint.shapes.flo.HANDLE_TYPE);
      handle.set('position', location);
      if ((isChrome || isFF) && parent && typeof parent.get('z') === 'number') {
        handle.set('z', parent.get('z') + 1);
      }
      handle.attr('./kind', kind);
      if (graph) {
        graph.addCell(handle);
      }
      parent.embed(handle);
      if (renderService && _.isFunction(renderService.initializeNewHandle)) {
        let descriptor : Flo.ViewerDescriptor = {
          paper: paper,
          graph: graph
        };
        renderService.initializeNewHandle(handle, descriptor);
      }
      return handle;
    }

  }
}

