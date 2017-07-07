import {Component, ElementRef} from '@angular/core';
const joint = require('jointjs');
const $ = require('jquery');

@Component({
  selector: 'flo-palette',
  templateUrl: './palette.component.html',
  styleUrls: ['./../shared/flo.css']
})
export class Palette {

  constructor(private element: ElementRef) {

  }

  ngOnInit() {
    let graph = new joint.dia.Graph();

    let containerElement = $(this.element.nativeElement).find('#myholder')[0];

    new joint.dia.Paper({
      el: containerElement,
      width: 600,
      height: 200,
      model: graph,
      gridSize: 1
    });

    let rect = new joint.shapes.basic.Rect({
      position: { x: 100, y: 30 },
      size: { width: 100, height: 30 },
      attrs: { rect: { fill: 'blue' }, text: { text: 'my box', fill: 'white' } }
    });

    let rect2 = rect.clone();
    rect2.translate(300);

    let link = new joint.dia.Link({
      source: { id: rect.id },
      target: { id: rect2.id }
    });

    graph.addCells([rect, rect2, link]);

    // $(this.element);

    console.log('Initializing my component');
  }

}
