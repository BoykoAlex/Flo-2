import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { LibComponent } from './component/lib.component';
import { LibService } from './service/lib.service';
import { Palette } from './palette/palette.component';
import { Editor } from './editor/editor.component';

@NgModule({
  imports: [ FormsModule ],
  declarations: [LibComponent, Palette, Editor],
  providers: [LibService],
  exports: [LibComponent, Palette, Editor]
})
export class LibModule { }
