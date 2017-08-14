import { Component } from '@angular/core';
import { Flo } from 'spring-flo';
const { Metamodel } = require('./metamodel');


@Component({
  selector: 'demo-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ]
})
export class AppComponent {

  metamodel : Flo.Metamodel;

  paletteSize = 170;

  constructor() {
    this.metamodel = new Metamodel();
  }
}
