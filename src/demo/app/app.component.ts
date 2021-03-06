import { Component, ViewEncapsulation } from '@angular/core';
import { NgModel } from '@angular/forms';
import { Flo } from 'spring-flo';
import { BsModalService } from 'ngx-bootstrap';
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

  constructor(private modelService : BsModalService) {
    this.metamodel = new Metamodel();
    this.renderer = new Renderer();
    this.editor = new Editor(modelService);
    this.dsl = '';
  }

  arrangeAll() {
    this.editorContext.performLayout().then(() => this.editorContext.fitToPage());
  }
}
