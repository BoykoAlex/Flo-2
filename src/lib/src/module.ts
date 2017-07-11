import { NgModule } from '@angular/core';

import { LibComponent } from './component/lib.component';
import { LibService } from './service/lib.service';
import { Palette } from "./palette/palette.component";
import { Editor } from "./editor/editor.component";

@NgModule({
  declarations: [LibComponent, Palette, Editor],
  providers: [LibService],
  exports: [LibComponent, Palette, Editor]
})
export class LibModule { }
