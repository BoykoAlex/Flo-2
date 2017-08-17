import { Component, ViewEncapsulation } from '@angular/core';
import { NgModel } from '@angular/forms';
import { Flo } from 'spring-flo';
const { Metamodel } = require('./metamodel');
const { Renderer } = require('./renderer');
const { Editor } = require('./editor');

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ],
  encapsulation: ViewEncapsulation.None
})
export class AppComponent {

  metamodel : Flo.Metamodel;
  renderer : Flo.Renderer;
  editor : Flo.Editor;
  dsl : string;
  dslEditor = false;

  private editorContext : Flo.EditorContext;

  paletteSize = 170;

  constructor() {
    this.metamodel = new Metamodel();
    this.renderer = new Renderer();
    this.editor = new Editor();
    this.dsl = '';
  }

  updateDsl(event : any) {
    console.log(`Update DSL with ${event.target.value} ` );
    this.dsl = event.target.value;
  }
}
