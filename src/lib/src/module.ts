import { NgModule } from '@angular/core';

import { LibComponent } from './component/lib.component';
import { LibService } from './service/lib.service';
import { Palette } from "./palette/palette.component";

@NgModule({
  declarations: [LibComponent, Palette],
  providers: [LibService],
  exports: [LibComponent, Palette]
})
export class LibModule { }
