import { Component } from '@angular/core';
import { Flo } from 'spring-flo';
const { Metamodel } = require('./metamodel');
const { Renderer } = require('./renderer');
const { Editor } = require('./editor');

@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ]
})
export class AppComponent {

  metamodel : Flo.Metamodel;
  renderer : Flo.Renderer;
  editor : Flo.Editor;

  paletteSize = 170;

  constructor() {
    this.metamodel = new Metamodel();
    this.renderer = new Renderer();
    this.editor = new Editor();
  }
}
