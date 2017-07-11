import { Directive, Input, Output, EventEmitter, Inject, ElementRef } from '@angular/core';
import { DOCUMENT } from '@angular/platform-browser'

const $ = require('jquery');

@Directive({
  selector: '[resizer]',
  host: {
    '(mousedown)': 'startDrag()'
  }
})
export class ResizerDirective {

  private vertical : boolean = true;

  private first : string;

  private second : string;

  private _size : number;

  private mouseMoveHandler = (e : any) => this.mousemove(e);
  private mouseUpHanlder = (e : any) => this.mouseup();

  @Input()
  maxSplitSize : number;

  @Input()
  set splitSize(splitSize : number) {

    if (this.maxSplitSize && splitSize > this.maxSplitSize) {
      splitSize = this.maxSplitSize;
    }

    if (this.vertical) {
      // Handle vertical resizer
      $(this.element.nativeElement).css({
        left: splitSize + 'px'
      });

      $(this.first).css({
        width: splitSize + 'px'
      });
      $(this.second).css({
        left: (splitSize + this._size) + 'px'
      });
    } else {
      // Handle horizontal resizer
      $(this.element.nativeElement).css({
        bottom: splitSize + 'px'
      });

      $(this.first).css({
        bottom: (splitSize + this._size) + 'px'
      });
      $(this.second).css({
        height: splitSize + 'px'
      });
    }

    // Update the local field
    this.sizeChange.emit(splitSize);
  }

  @Output()
  sizeChange = new EventEmitter<number>();

  @Input()
  set resizerWidth(width : number) {
    this._size = width;
    this.vertical = true;
  }

  @Input()
  set resizerHeight(height : number) {
    this._size = height;
    this.vertical = false;
  }

  @Input()
  set resizerLeft(first : string) {
    this.first = first;
  }

  @Input()
  set resizerTop(first : string) {
    this.first = first;
  }

  @Input()
  set resizerRight(second : string) {
    this.second = second;
  }


  @Input()
  set resizerBottom(second : string) {
    this.second = second;
  }

  constructor(private element : ElementRef, @Inject(DOCUMENT) private document : any) {
    console.log('Building Resizer!!!');
  }

  private startDrag() {
    console.log('RESIZER: CLICK!!! Size=' + this._size);
    $(document).on('mousemove', this.mouseMoveHandler);
    $(document).on('mouseup', this.mouseUpHanlder);
  }

  private mousemove(event : any) {
    let size : number;
    if (this.vertical) {
      // Handle vertical resizer. Calculate new size relative to palette container DOM node
      size = event.pageX - $(this.first).offset().left;
    } else {
      // Handle horizontal resizer Calculate new size relative to palette container DOM node
      size = window.innerHeight - event.pageY - $(this.second).offset().top;
    }
    this.splitSize = size;
  }

  private mouseup() {
    $(this.document).unbind('mousemove', this.mouseMoveHandler);
    $(this.document).unbind('mouseup', this.mouseUpHanlder);
  }

}
