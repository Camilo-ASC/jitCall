import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditContactPage } from './edit-contact.page';

describe('EditContactPage', () => {
  let component: EditContactPage;
  let fixture: ComponentFixture<EditContactPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(EditContactPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
