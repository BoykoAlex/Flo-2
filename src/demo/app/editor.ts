/*
 * Copyright 2016 the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Flo, Constants } from 'spring-flo';
import { dia } from 'jointjs';

const joint = require('jointjs');

/**
 * @author Alex Boyko
 * @author Andy Clement
 */
export class Editor implements Flo.Editor {

    createHandles(context : Flo.EditorContext, createHandle : (owner : dia.CellView, kind : string, action : () => void, location : dia.Point) => void, owner : dia.CellView) {
      let bbox : any = owner.getBBox();
      let pt = bbox.origin().offset(bbox.width + 3, bbox.height + 3);
      createHandle(owner, Constants.REMOVE_HANDLE_TYPE, context.deleteSelectedNode, pt);
    }

    validatePort(context : Flo.EditorContext, view : dia.ElementView, magnet : SVGElement) {
      return true;
    }

    validateLink(context : Flo.EditorContext, cellViewS : dia.ElementView, magnetS : SVGElement, cellViewT : dia.ElementView, magnetT : SVGElement, isSource : boolean, linkView : dia.LinkView) {
      // Prevent linking from input ports.
      if (magnetS && magnetS.getAttribute('type') === 'input') {
        return false;
      }
      // Prevent linking from output ports to input ports within one element.
      if (cellViewS === cellViewT) {
        return false;
      }
      // Prevent linking to input ports.
      if (magnetT && magnetT.getAttribute('type') === 'output') {
        return false;
      }
      return cellViewS.model && cellViewT.model && !(cellViewS.model instanceof joint.shapes.flo.ErrorDecoration) && !(cellViewT.model instanceof joint.shapes.flo.ErrorDecoration);
    }

    preDelete(context : Flo.EditorContext, deletedElement : dia.Cell) {
      if (deletedElement instanceof joint.dia.Element) {
        this.repairDamage(context, <dia.Element> deletedElement);
      }
    }

    handleNodeDropping(context : Flo.EditorContext, dragDescriptor : Flo.DnDDescriptor) {
      let relinking = dragDescriptor.context === Constants.PALETTE_CONTEXT;
      let graph = context.getGraph();
      let source = dragDescriptor.source ? dragDescriptor.source.view.model : undefined;
      let target = dragDescriptor.target ? dragDescriptor.target.view.model : undefined;
      if (target instanceof joint.dia.Element && target.attr('metadata/name')) {
        // Custom handling allowing a node to be dropped on a port and inserting
        // it into the flow directly without the user needing to do more link
        // drawing
        let type = source.attr('metadata/name');
        if (dragDescriptor.target.selector === '.output-port') {
          this.moveNodeOnNode(context, <dia.Element> source, <dia.Element> target, 'right', true);
          relinking = true;
        } else if (dragDescriptor.target.selector === '.input-port') {
          this.moveNodeOnNode(context, <dia.Element> source, <dia.Element> target, 'left', true);
          relinking = true;
        }
      } else if (target instanceof joint.dia.Link) { // jshint ignore:line
        // Custom handling allowing a node to be dropped on a link and inserting
        // itself in that link without the user needing to do more link drawing
        this.moveNodeOnLink(context, <dia.Element> source, <dia.Link> target, false);
        relinking = true;
      }
      // Turn off auto layout
//	            if (relinking) {
//	                flo.performLayout();
//	            }
    }

    calculateDragDescriptor(context : Flo.EditorContext, draggedView : dia.CellView, targetUnderMouse : dia.CellView, point : dia.Point, sourceComponent : string) : Flo.DnDDescriptor {
      let source = draggedView.model;
      let sourceGroup = source.attr('metadata/group');

      // Find closest port
      let range = 30;
      let graph = context.getGraph();
      let paper = context.getPaper();
      let closestData : Flo.DnDDescriptor;
      let minDistance = Number.MAX_VALUE;
      let maxIcomingLinks = sourceGroup === 'source' ? 0 : 1;
      let maxOutgoingLinks = sourceGroup === 'sink' ? 0 : 1;
      let hasIncomingPort = sourceGroup !== 'source';
      let hasOutgoingPort = sourceGroup !== 'sink';
      if (!hasIncomingPort && !hasOutgoingPort) {
        return;
      }
      let elements = graph.findModelsInArea(joint.g.rect(point.x - range, point.y - range, 2 * range, 2 * range)); // jshint ignore:line
      if (Array.isArray(elements)) {
        elements.forEach(function(model) {
          let view = paper.findViewByModel(model);
          if (view && view !== draggedView && model instanceof joint.dia.Element) { // jshint ignore:line
            let targetGroup = model.attr('metadata/group');
            let targetMaxIcomingLinks = targetGroup === 'source' ? 0 : 1;
            let targetMaxOutgoingLinks = targetGroup === 'sink' ? 0 : 1;
            let targetHasIncomingPort = targetGroup !== 'source';
            let targetHasOutgoingPort = targetGroup !== 'sink';
            view.$('[magnet]').each((index : number, magnet : HTMLElement) => {
              let type = magnet.getAttribute('type');
              if ((type === 'input' && targetHasIncomingPort && hasOutgoingPort) || (type === 'output' && targetHasOutgoingPort && hasIncomingPort)) {
                let bbox = joint.V(magnet).bbox(false, paper.viewport); // jshint ignore:line
                let distance = (<any> point).distance({
                  x: bbox.x + bbox.width / 2,
                  y: bbox.y + bbox.height / 2
                });
                if (distance < range && distance < minDistance) {
                  minDistance = distance;
                  closestData = {
                    source: {
                      view: draggedView,
                      selector: type === 'output' ? '.input-port' : '.output-port'
                    },
                    target: {
                      view: view,
                      selector: '.' + type+'-port'
                    },
                    range: minDistance
                  };
                }
              }
            });
          }
        });
      }
      if (closestData) {
        return closestData;
      }

      // Check if drop on a link is allowed
      if (targetUnderMouse instanceof joint.dia.Link &&
        sourceGroup === 'processor' &&
        graph.getConnectedLinks(source).length === 0) { // jshint ignore:line
        return {
          source: {
            view: draggedView
          },
          target: {
            view: targetUnderMouse
          }
        };
      }

      return {
        source: {
          view: draggedView
        }
      };
    }

    validate(graph : dia.Graph) : Promise<Map<string, Array<Flo.Marker>>> {
      return new Promise((resolve, reject) => {
        let markers = new Map<string, Array<Flo.Marker>>();
        resolve(markers);
      });
      // var errors = [];
      // var graph = flo.getGraph();
      // var constraints = element.attr('metadata/constraints');
      // if (constraints) {
      //   var incoming = graph.getConnectedLinks(element, {inbound: true});
      //   var outgoing = graph.getConnectedLinks(element, {outbound: true});
      //   if (typeof constraints.maxIncomingLinksNumber === 'number' || typeof constraints.minIncomingLinksNumber === 'number') {
      //     if (typeof constraints.maxIncomingLinksNumber === 'number' && constraints.maxIncomingLinksNumber < incoming.length) {
      //       if (constraints.maxIncomingLinksNumber === 0) {
      //         errors.push({
      //           message: 'Sources must appear at the start of a stream',
      //           range: element.attr('range')
      //         });
      //       } else {
      //         errors.push({
      //           message: 'Max allowed number of incoming links is ' + constraints.maxIncomingLinksNumber,
      //           range: element.attr('range')
      //         });
      //       }
      //     }
      //     if (typeof constraints.minIncomingLinksNumber === 'number' && constraints.minIncomingLinksNumber > incoming.length) {
      //       errors.push({
      //         message: 'Min allowed number of incoming links is ' + constraints.minIncomingLinksNumber,
      //         range: element.attr('range')
      //       });
      //     }
      //   }
      //   if (typeof constraints.maxOutgoingLinksNumber === 'number' || typeof constraints.minOutgoingLinksNumber === 'number') {
      //     if (typeof constraints.maxOutgoingLinksNumber === 'number' && constraints.maxOutgoingLinksNumber < outgoing.length) {
      //       if (constraints.maxOutgoingLinksNumber === 0) {
      //         errors.push({
      //           message: 'Sinks must appear at the end of a stream',
      //           range: element.attr('range')
      //         });
      //       } else {
      //         errors.push({
      //           message: 'Max allowed number of outgoing links is ' + constraints.maxOutgoingLinksNumber,
      //           range: element.attr('range')
      //         });
      //       }
      //     }
      //     if (typeof constraints.minOutgoingLinksNumber === 'number' && constraints.minOutgoingLinksNumber > outgoing.length) {
      //       errors.push({
      //         message: 'Min allowed number of outgoing links is ' + constraints.minOutgoingLinksNumber,
      //         range: element.attr('range')
      //       });
      //     }
      //   }
      //   if (constraints.xorSourceSink && incoming.length && outgoing.length) {
      //     errors.push({
      //       message: 'Node can either have incoming or outgoing links, but not both',
      //       range: element.attr('range')
      //     });
      //   }
      // }
      // if (!element.attr('metadata') || element.attr('metadata/unresolved')) {
      //   var msg = 'Unknown element \'' + element.attr('metadata/name') + '\'';
      //   if (element.attr('metadata/group')) {
      //     msg += ' from group \'' + element.attr('metadata/group') + '\'.';
      //   }
      //   errors.push({
      //     message: msg,
      //     range: element.attr('range')
      //   });
      // }
      //
      // // If possible, verify the properties specified match those allowed on this type of element
      // // propertiesRanges are the ranges for each property included the entire '--name=value'.
      // // The format of a range is {'start':{'ch':NNNN,'line':NNNN},'end':{'ch':NNNN,'line':NNNN}}
      // var propertiesRanges = element.attr('propertiesranges');
      // if (propertiesRanges) {
      //   var moduleSchema = element.attr('metadata');
      //   // Grab the list of supported properties for this module type
      //   moduleSchema.get('properties').then(function(moduleSchemaProperties) {
      //     if (!moduleSchemaProperties) {
      //       moduleSchemaProperties = {};
      //     }
      //     // Example moduleSchemaProperties:
      //     // {"host":{"name":"host","type":"String","description":"the hostname of the mail server","defaultValue":"localhost","hidden":false},
      //     //  "password":{"name":"password","type":"String","description":"the password to use to connect to the mail server ","defaultValue":null,"hidden":false}
      //     var specifiedProperties = element.attr('props');
      //     Object.keys(specifiedProperties).forEach(function(propertyName) {
      //       if (!moduleSchemaProperties[propertyName]) {
      //         // The schema does not mention that property
      //         var propertyRange = propertiesRanges[propertyName];
      //         if (propertyRange) {
      //           errors.push({
      //             message: 'unrecognized option \''+propertyName+'\' for module \''+element.attr('metadata/name')+'\'',
      //             range: propertyRange
      //           });
      //         }
      //       }
      //     });
      //   });
      // }
      //
      // return errors;
    }

    moveNodeOnNode(context : Flo.EditorContext, node : dia.Element, pivotNode : dia.Element, side : string, shouldRepairDamage : boolean) {
//       side = side || 'left';
//       if (this.canSwap(context, node, pivotNode, side)) {
//         let link : dia.Link;
//         let i : number;
//         if (side === 'left') {
//           let sources : Array<string> = [];
//           if (shouldRepairDamage) {
//             /*
//              * Commented out because it doesn't prevent cycles.
//              */
// //							if (graph.getConnectedLinks(pivotNode, {inbound: true}).length > 0 || graph.getConnectedLinks(node, {outbound: true}).length > 0) {
//             this.repairDamage(context, node);
// //							}
//           }
//           context.getGraph().getConnectedLinks(pivotNode, {inbound: true}).forEach(link => {
//             sources.push(link.get('source').id);
//             link.remove();
//           });
//           sources.forEach(id => {
//             context.createLink({
//               'id': id,
//               'selector': '.output-port'
//             }, {
//               'id': node.id,
//               'selector': '.input-port'
//             });
//           })
//           for (i = 0; i < sources.length; i++) {
//             flo.createLink({
//               'id': sources[i],
//               'selector': '.output-port'
//             }, {
//               'id': node.id,
//               'selector': '.input-port'
//             });
//           }
//           flo.createLink({
//             'id': node.id,
//             'selector': '.output-port'
//           }, {
//             'id': pivotNode.id,
//             'selector': '.input-port'
//           });
//         } else if (side === 'right') {
//           var targets = [];
//           if (shouldRepairDamage) {
//             /*
//              * Commented out because it doesn't prevent cycles.
//              */
// //							if (graph.getConnectedLinks(pivotNode, {outbound: true}).length > 0 || graph.getConnectedLinks(node, {inbound: true}).length > 0) {
//             repairDamage(flo, node);
// //							}
//           }
//           var pivotSourceLinks = flo.getGraph().getConnectedLinks(pivotNode, {outbound: true});
//           for (i = 0; i < pivotSourceLinks.length; i++) {
//             link = pivotSourceLinks[i];
//             targets.push(link.get('target').id);
//             link.remove();
//           }
//           for (i = 0; i < targets.length; i++) {
//             flo.createLink({
//               'id': node.id,
//               'selector': '.output-port'
//             }, {
//               'id': targets[i],
//               'selector': '.input-port'
//             });
//           }
//           flo.createLink({
//             'id': pivotNode.id,
//             'selector': '.output-port'
//           }, {
//             'id': node.id,
//             'selector': '.input-port'
//           });
//         }
//       }
    }

    /**
     * Node moved onto a link. Remove the existing link and replace it with two links
     * that go from the original link source to the dropped node and from the dropped node
     * to the original link target.
     */
    moveNodeOnLink(context : Flo.EditorContext, node : dia.Element, link : dia.Link, shouldRepairDamage : boolean) {
      // var source = link.get('source').id;
      // var target = link.get('target').id;
      //
      // if (shouldRepairDamage) {
      //   repairDamage(flo, node);
      // }
      // link.remove();
      //
      // if (source) {
      //   flo.createLink({'id': source,'selector': '.output-port'}, {'id': node.id,'selector': '.input-port'});
      // }
      // if (target) {
      //   flo.createLink({'id': node.id,'selector': '.output-port'}, {'id': target,'selector': '.input-port'});
      // }
    }

    /**
     * When a node is removed any dangling links should be removed. What this function will also try to do
     * is if removing a node from a chain it will attempt to replace dangling links with a link from the
     * deleted nodes original source to the deleted nodes original target.
     */
    repairDamage(context : Flo.EditorContext, node : dia.Element) {
      // let sources : Array<string> = [];
      // let targets : Array<string> = [];
      // let i = 0;
      // context.getGraph().getConnectedLinks(node).forEach(link => {
      //   let targetId = link.get('target').id;
      //   let sourceId = link.get('source').id;
      //   if (targetId === node.id) {
      //     link.remove();
      //     sources.push(sourceId);
      //   } else if (sourceId === node.id) {
      //     link.remove();
      //     targets.push(targetId);
      //   }
      // });
      // /*
      //  * If appropriate, create new links to replace the dangling ones deleted
      //  */
      // if (sources.length === 1) {
      //   var source = sources[0];
      //   for (i = 0; i < targets.length; i++) {
      //     flo.createLink({'id': source,'selector': '.output-port'}, {'id': targets[i],'selector': '.input-port'});
      //   }
      // } else if (targets.length === 1) {
      //   var target = targets[0];
      //   for (i = 0; i < sources.length; i++) {
      //     flo.createLink({'id': sources[i], 'selector': '.output-port'}, {'id': target,'selector': '.input-port'});
      //   }
      // }
    }

    /**
     * Check if node being dropped and drop target node next to each other such that they won't be swapped by the drop
     */
    canSwap(context : Flo.EditorContext, dropee : dia.Element, target : dia.Element, side : string) : boolean {
      let i, targetId, sourceId, noSwap = (dropee.id === target.id);
      if (dropee === target) {
        console.debug('What!??? Dragged == Dropped!!! id = ' + target);
      }
      let links = context.getGraph().getConnectedLinks(dropee);
      for (i = 0; i < links.length && !noSwap; i++) {
        targetId = links[i].get('target').id;
        sourceId = links[i].get('source').id;
        noSwap = (side === 'left' && targetId === target.id && sourceId === dropee.id) || (side === 'right' && targetId === dropee.id && sourceId === target.id);
      }
      return !noSwap;
    }

}
