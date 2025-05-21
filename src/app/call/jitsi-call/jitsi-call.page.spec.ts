import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JitsiCallPage } from './jitsi-call.page';

describe('JitsiCallPage', () => {
  let component: JitsiCallPage;
  let fixture: ComponentFixture<JitsiCallPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(JitsiCallPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
