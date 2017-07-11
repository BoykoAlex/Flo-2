import { Component, Input, ElementRef, OnInit, OnDestroy, OnChanges, SimpleChanges} from '@angular/core';
import { dia } from 'jointjs';
import { Flo } from './../shared/flo.common';
const joint = require('jointjs');
const $ = require('jquery');

@Component({
  selector: 'flo-editor',
  templateUrl: './editor.component.html',
  styleUrls: ['./../shared/flo.css']
})
export class Editor implements OnInit, OnDestroy, OnChanges {

  @Input()
  metamodel : Flo.Metamodel;

  @Input()
  paletteSize : number;

  constructor(private element : ElementRef) {

  }

  ngOnInit() {
    let graph : dia.Graph = new joint.dia.Graph();

    new joint.dia.Paper({
      el: $('#paper', this.element.nativeElement),
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

  ngOnDestroy() {

  }

  ngOnChanges(changes : SimpleChanges) {

  }

}

