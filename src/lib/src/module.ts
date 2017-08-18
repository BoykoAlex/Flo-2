import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';

import { LibComponent } from './component/lib.component';
import { LibService } from './service/lib.service';
import { Palette } from './palette/palette.component';
import { EditorComponent } from './editor/editor.component';
import { ResizerDirective } from './directives/resizer';
import { DslEditorComponent } from './dsl-editor/dsl.editor.component';

@NgModule({
  imports: [ FormsModule, BrowserModule ],
  declarations: [LibComponent, Palette, EditorComponent, ResizerDirective, DslEditorComponent],
  providers: [LibService],
  exports: [LibComponent, Palette, EditorComponent, DslEditorComponent]
})
export class FloModule { }
