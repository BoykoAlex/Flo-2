import {Component, ElementRef, Input, OnInit, OnDestroy, OnChanges, SimpleChanges} from '@angular/core';
import { dia } from 'jointjs';
import { Flo } from './../shared/flo.common';
import { Shapes } from './../shared/shapes';

const joint = require('jointjs');
const $ = require('jquery');

joint.shapes.flo.PaletteGroupHeader = joint.shapes.basic.Generic.extend({
  // The path is the open/close arrow, defaults to vertical (open)
  markup: '<g class="scalable"><rect/></g><text/><g class="rotatable"><path d="m 10 10 l 5 8.7 l 5 -8.7 z"/></g>',
  defaults: joint.util.deepSupplement({
    type: 'palette.groupheader',
    size:{width:170,height:30},
    position:{x:0,y:0},
    attrs: {
      'rect': { fill: '#34302d', 'stroke-width': 1, stroke: '#6db33f', 'follow-scale':true, width:80, height:40 },
      'text': {
        text:'',
        fill: '#eeeeee',
        'ref-x': 0.5,
        'ref-y': 7,
        'x-alignment':'middle',
        'font-size': 18/*, 'font-weight': 'bold', 'font-variant': 'small-caps', 'text-transform': 'capitalize'*/
      },
      'path': { fill: 'white', 'stroke-width': 2, stroke: 'white'/*,transform:'rotate(90,15,15)'*/}
    },
    // custom properties
    isOpen:true
  }, joint.shapes.basic.Generic.prototype.defaults)
});

export interface PaletteDnDEvent {
  type : string;
  element : dia.CellView;
  event : any;
}

@Component({
  selector: 'flo-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./../shared/flo.css']
})
export class Palette implements OnInit, OnDestroy, OnChanges {

  private static MetamodelListener = class {

    constructor(private palette : Palette) {}

    metadataError(data : any) : void {
      console.error(JSON.stringify(data));
    }

    metadataAboutToChange() : void {

    }

    metadataChanged(data : Flo.MetadataChangedData) : void {
      this.palette.buildPalette(data.newData);
    }
  };

  @Input()
  metamodel : Flo.Metamodel;

  @Input()
  renderer : any;

  @Input()
  paletteEntryPadding : dia.Size = {width:12, height:12};

  @Input()
  paletteSize : number;

  private _filterText : string = '';

  private paletteGraph : dia.Graph;

  private palette : dia.Paper;


  private _metamodelListener : Flo.MetamodelListener;

  /**
   * The names of any groups in the palette that have been deliberately closed (the arrow clicked on)
   * @type {String[]}
   */
  private closedGroups : Set<string>;

  /**
   * Model of the clicked element
   */
  private clickedElement : dia.Cell;

  private viewBeingDragged : dia.CellView;

  constructor(private element: ElementRef) {
    this.paletteGraph = new joint.dia.Graph();
    this.paletteGraph.set('type', joint.shapes.flo.PALETTE_TYPE);
    this._filterText = '';

    this.closedGroups = new Set<string>();

    this._metamodelListener = new Palette.MetamodelListener(this);
  }

  printFilterText() {
    console.log('Filter Text = ' + this.filterText);
    setTimeout(() => this.printFilterText(), 2000);
  }

  ngOnInit() {
    // Create the paper for the palette using the specified element view
    this.palette = new joint.dia.Paper({
      el: $('#palette-paper', this.element.nativeElement),
      gridSize:1,
      model: this.paletteGraph,
      height: $(this.element.nativeElement.parentNode).height(),
      width: $(this.element.nativeElement.parentNode).width(),
      elementView: this.renderer && this.renderer.getNodeView ? this.renderer.getNodeView() : joint.dia.ElementView
    });

    // palette.on('cell:pointerup',
    //   function(cellview, evt) {
    //     console.debug('pointerup');
    //     if (this.viewBeingDragged) {
    //       trigger('drop',{'dragged':viewBeingDragged,'evt':evt});
    //       viewBeingDragged = null;
    //     }
    //     clickedElement = null;
    //     $('#palette-floater').remove();
    //   });
    //
    // // Toggle the header open/closed on a click
    // palette.on('cell:pointerclick',
    //   function(cellview/*,evt*/) {
    //     // TODO [design][palette] should the user need to click on the arrow rather than anywhere on the header?
    //     // Click position within the element would be: evt.offsetX, evt.offsetY
    //     var element = cellview.model;
    //     if (cellview.model.attributes.header) {
    //       // Toggle the header open/closed
    //       if (element.get('isOpen')) {
    //         rotateClosed(element);
    //       } else {
    //         rotateOpen(element);
    //       }
    //     }
    //     // TODO [palette] ensure other mouse handling events do nothing for headers
    //     // TODO [palette] move 'metadata' field to the right place (not inside attrs I think)
    //   });

    // $(document).on('mouseup', handleMouseUp);

    if (this.metamodel) {
      this.metamodel.load().then(data => {
        this.buildPalette(data);
        if (this.metamodel && this.metamodel.subscribe) {
          this.metamodel.subscribe(this._metamodelListener);
        }
      });
    } else {
      console.error('No Metamodel service specified for palette!');
    }

    this.paletteSize = this.paletteSize || $(this.element.nativeElement.parentNode).width();

    this.printFilterText();

  }

  ngOnDestroy() {
      if (this.metamodel && this.metamodel.unsubscribe) {
        this.metamodel.unsubscribe(this._metamodelListener);
      }

      //TODO: deal with palette DnD
      // $(document).off('mouseup', handleMouseUp);
  }

  ngOnChanges(changes : SimpleChanges) {
    console.log('Changed!!!');
    if (changes.hasOwnProperty('paletteSize') || changes.hasOwnProperty('filterText')) {
      this.metamodel.load().then(metamodel => this.buildPalette(metamodel));
    }
  }

  private createPaletteGroup(title : string, isOpen : boolean) : dia.Element {
    let newGroupHeader = new joint.shapes.flo.PaletteGroupHeader({attrs:{text:{text:title}}});
    newGroupHeader.set('header',title);
    if (!isOpen) {
      newGroupHeader.attr({'path':{'transform':'rotate(-90,15,13)'}});
      newGroupHeader.set('isOpen',false);
    }
    this.paletteGraph.addCell(newGroupHeader);
    return newGroupHeader;
  }

  private createPaletteEntry(title : string, metadata : Flo.ElementMetadata) {
    return Shapes.Factory.createNode({
      renderService: this.renderer,
      paper: this.palette,
      metadata: metadata
    });
  }

  private buildPalette(metamodel : Map<string, Map<string, Flo.ElementMetadata>>) {
    let startTime : number = new Date().getTime();

    this.paletteGraph.clear();

    let filterText = this.filterText;
    if (filterText) {
      filterText = filterText.toLowerCase();
    }

    let paletteNodes : Array<dia.Element> = [];
    let groupAdded : Set<string> = new Set<string>();

    let parentWidth : number = $(this.element.nativeElement.parentNode).width();

    // The field closedGroups tells us which should not be shown
    // Work out the list of active groups/nodes based on the filter text
    this.metamodel.groups().forEach(group => {
      if (metamodel.has(group)) {
        Array.from(metamodel.get(group).keys()).sort().forEach(name => {
          let node : Flo.ElementMetadata = metamodel.get(group).get(name);
          let nodeActive : boolean = !(node.metadata && node.metadata.noPaletteEntry);
          if (nodeActive && filterText) {
            nodeActive = false;
            if (name.toLowerCase().indexOf(filterText) !== -1) {
              nodeActive = true;
            }
            else if (group.toLowerCase().indexOf(filterText) !== -1) {
              nodeActive = true;
            }
            // else if (node.description && node.description.toLowerCase().indexOf(filterText) !== -1) {
            //   nodeActive = true;
            // }
            // else if (node.properties) {
            //   Object.keys(node.properties).sort().forEach(function(propertyName) {
            //     if (propertyName.toLowerCase().indexOf(filterText) !== -1 ||
            //       (node.properties[propertyName].description &&
            //       node.properties[propertyName].description.toLowerCase().indexOf(filterText) !== -1)) {
            //       nodeActive=true;
            //     }
            //   });
            // }
          }
          if (nodeActive) {
            if (!groupAdded.has(group)) {
              let header : dia.Element = this.createPaletteGroup(group, !this.closedGroups.has(group));
              header.set('size', {width: parentWidth, height: 30});
              paletteNodes.push(header);
              groupAdded.add(group);
            }
            if (!this.closedGroups.has(group)) {
              paletteNodes.push(this.createPaletteEntry(name, node));
            }
          }
        });
      }
    });

    let cellWidth : number = 0, cellHeight : number = 0;
    // Determine the size of the palette entry cell (width and height)
    paletteNodes.forEach(pnode => {
      if (pnode.attr('metadata/name')) {
        let dimension : dia.Size = {
          width: pnode.get('size').width,
          height: pnode.get('size').height
        };
        if (cellWidth < dimension.width) {
          cellWidth = dimension.width;
        }
        if (cellHeight < dimension.height) {
          cellHeight = dimension.height;
        }
      }
    });

    // Adjust the palette entry cell size with paddings.
    cellWidth += 2 * this.paletteEntryPadding.width;
    cellHeight += 2 * this.paletteEntryPadding.height;

    // Align palette entries row to be at the center
    let startX : number = parentWidth >= cellWidth ? (parentWidth - Math.floor(parentWidth / cellWidth) * cellWidth) / 2 : 0;
    let xpos : number = startX;
    let ypos : number = 0;
    let prevNode : dia.Element;

    // Layout palette entry nodes
    paletteNodes.forEach(pnode => {
      let dimension : dia.Size = {
        width: pnode.get('size').width,
        height: pnode.get('size').height
      };
      if (pnode.get('header')) { //attributes.attrs.header) {
        // Palette entry header
        xpos = startX;
        pnode.set('position',{x:0, y:ypos});
        ypos += dimension.height + 5;
      } else {
        // Palette entry element
        if (xpos + cellWidth > parentWidth) {
          // Not enough real estate to place entry in a row - reset x position and leave the y pos which is next line
          xpos = startX;
          pnode.set('position', { x: xpos + (cellWidth - dimension.width) / 2, y: ypos + (cellHeight - dimension.height) / 2});
        } else {
          // Enough real estate to place entry in a row - adjust y position
          if (prevNode && prevNode.attr('metadata/name')) {
            ypos -= cellHeight;
          }
          pnode.set('position', { x: xpos + (cellWidth - dimension.width) / 2, y: ypos + (cellHeight - dimension.height) / 2});
        }
        // increment x position and y position (can be reorganized)
        xpos += cellWidth;
        ypos += cellHeight;
      }
      prevNode = pnode;
    });
    this.palette.setDimensions(parentWidth, ypos);
    console.info('buildPalette took '+(new Date().getTime()-startTime)+'ms');
  }

  set filterText(text : string) {
    this._filterText = text;
    this.metamodel.load().then(metamodel => this.buildPalette(metamodel));
  }

  get filterText() : string {
    return this._filterText;
  }

  // private getPaletteView(view : any) {
  //   return view.extend({
  //     pointerdown: function(/*evt, x, y*/) {
  //       // Remove the tooltip
  //       $('.node-tooltip').remove();
  //       // TODO move metadata to the right place (not inside attrs I think)
  //       this.clickedElement = this.model;
  //       if (this.clickedElement.attr('metadata')) {
  //         $(document).on('mousemove', handleDrag);
  //       }
  //     },
  //     pointermove: function(/*evt, x, y*/) {
  //       // Nothing to prevent move within the palette canvas
  //     },
      // events: {
      //   // Tooltips on the palette elements
      //   'mouseenter': function(evt) {
      //
      //     // Ignore 'mouseenter' if any other buttons are pressed
      //     if (evt.buttons) {
      //       return;
      //     }
      //
      //     var model = this.model;
      //     var metadata = model.attr('metadata');
      //     if (!metadata) {
      //       return;
      //     }
      //
      //     this.showTooltip(evt.pageX, evt.pageY);
      //   },
      //   // TODO bug here - if the call to get the info takes a while, the tooltip may appear after the pointer has left the cell
      //   'mouseleave': function(/*evt, x,y*/) {
      //     this.hideTooltip();
      //   },
      //   'mousemove': function(evt) {
      //     this.moveTooltip(evt.pageX, evt.pageY);
      //   }
      // },

      // showTooltip: function(x, y) {
      //   var model = this.model;
      //   var metadata = model.attr('metadata');
      //   // TODO refactor to use tooltip module
      //   var nodeTooltip = document.createElement('div');
      //   $(nodeTooltip).addClass('node-tooltip');
      //   $(nodeTooltip).appendTo($('body')).fadeIn('fast');
      //   var nodeDescription = document.createElement('div');
      //   $(nodeTooltip).addClass('tooltip-description');
      //   $(nodeTooltip).append(nodeDescription);
      //
      //   metadata.get('description').then(function(description) {
      //     $(nodeDescription).text(description ? description : model.attr('metadata/name'));
      //   }, function() {
      //     $(nodeDescription).text(model.attr('metadata/name'));
      //   });
      //
      //   if (!metadata.metadata || !metadata.metadata['hide-tooltip-options']) {
      //     metadata.get('properties').then(function(metaProps) {
      //       if (metaProps) {
      //         Object.keys(metaProps).sort().forEach(function(propertyName) {
      //           var optionRow = document.createElement('div');
      //           var optionName = document.createElement('span');
      //           var optionDescription = document.createElement('span');
      //           $(optionName).addClass('node-tooltip-option-name');
      //           $(optionDescription).addClass('node-tooltip-option-description');
      //           $(optionName).text(metaProps[propertyName].name);
      //           $(optionDescription).text(metaProps[propertyName].description);
      //           $(optionRow).append(optionName);
      //           $(optionRow).append(optionDescription);
      //           $(nodeTooltip).append(optionRow);
      //         });
      //       }
      //     }, function(error) {
      //       if (error) {
      //         $log.error(error);
      //       }
      //     });
      //   }
      //
      //   var mousex = x + 10;
      //   var mousey = y + 10;
      //   $('.node-tooltip').css({ top: mousey, left: mousex });
      // },
      //
      // hideTooltip: function() {
      //   $('.node-tooltip').remove();
      // },
      //
      // moveTooltip: function(x, y) {
      //   var mousex = x + 10; // Get X coordinates
      //   var mousey = y + 10; // Get Y coordinates
      //   $('.node-tooltip').css({ top: mousey, left: mousex });
      // }

  //   });
  // }

  // function trigger(triggerEvent,paramsObject) {
  //   if ($scope.paletteObservers) {
  //     $scope.paletteObservers.fireEvent(triggerEvent, paramsObject);
  //   }
  // }
  //
  // function handleDrag(event) {
  //   // TODO offsetX/Y not on firefox
  //   //$log.debug("tracking move: x="+event.pageX+",y="+event.pageY);
  //   if (clickedElement && clickedElement.attr('metadata')) {
  //     if (!viewBeingDragged) {
  //       var dataOfClickedElement = clickedElement.attr('metadata');
  //       // custom div if not already built.
  //       $('<div>', {
  //         id: 'palette-floater'
  //       }).appendTo($('body'));
  //       var floatergraph = new joint.dia.Graph();
  //       floatergraph.attributes.type = joint.shapes.flo.FEEDBACK_TYPE;
  //       var floaterpaper = new joint.dia.Paper({
  //         el: $('#palette-floater'),
  //         elementView: renderService && angular.isFunction(renderService.getNodeView) ? renderService.getNodeView() : joint.dia.ElementView,
  //         gridSize:10,
  //         model: floatergraph,
  //         height: 400,
  //         width: 200,
  //         validateMagnet: function() {
  //           return false;
  //         },
  //         validateConnection: function() {
  //           return false;
  //         }
  //       });
  //       // TODO float thing needs to be bigger otherwise icon label is missing
  //       // Initiative drag and drop - create draggable element
  //       var floaternode = shapesFactory.createNode({
  //         'renderService': renderService,
  //         'paper': floaterpaper,
  //         'graph': floatergraph,
  //         'metadata': dataOfClickedElement
  //       });
  //       var box = floaterpaper.findViewByModel(floaternode).getBBox();
  //       var size = floaternode.get('size');
  //       // Account for node real size including ports
  //       floaternode.translate(box.width - size.width, box.height - size.height);
  //       viewBeingDragged = floaterpaper.findViewByModel(floaternode);
  //       $('#palette-floater').offset({left:event.pageX+5,top:event.pageY+5});
  // //					trigger('dragStarted',{'dragged':viewBeingDragged,'x':x,'y':y});
  //     } else {
  //       $('#palette-floater').offset({left:event.pageX+5,top:event.pageY+5});
  //       trigger('drag',{'dragged':viewBeingDragged,'evt':event});
  //
  //     }
  //   }
  // }

}
