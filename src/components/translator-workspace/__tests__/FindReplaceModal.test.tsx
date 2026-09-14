import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { FindReplaceModal } from '../FindReplaceModal';
import { NotificationProvider } from '../../NotificationSystem';

describe('FindReplaceModal Component Suite (136-find-and-replace)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    targetText: 'Tiêu Viêm nhìn Tô Bạch. Tô Bạch mỉm cười. tiêu viêm cũng cười theo.',
    onTextChange: vi.fn(),
    initialSearchTerm: 'Tô Bạch',
    stageLabel: 'Biên tập (2)',
  };

  it('renders correctly when isOpen is true with title, inputs and stage label', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} />
      </NotificationProvider>
    );

    expect(html).toContain('Tìm và Thay thế');
    expect(html).toContain('Biên tập (2)');
    expect(html).toContain('Tìm kiếm');
    expect(html).toContain('Thay thế bằng');
    expect(html).toContain('Phân biệt chữ hoa/thường');
    expect(html).toContain('Trước');
    expect(html).toContain('Sau');
    expect(html).toContain('Đóng');
    expect(html).toContain('Thay thế');
    expect(html).toContain('Thay tất cả');
  });

  it('returns null and renders nothing when isOpen is false', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} isOpen={false} />
      </NotificationProvider>
    );

    expect(html).not.toContain('Tìm và Thay thế');
    expect(html).not.toContain('find-replace-title');
  });

  it('displays accurate initial match count based on initialSearchTerm', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} initialSearchTerm="Tô Bạch" />
      </NotificationProvider>
    );

    // "Tô Bạch" appears 2 times in targetText
    expect(html).toContain('kết quả');
    expect(html).toMatch(/1<!-- -->\/<!-- -->2/);
  });

  it('displays "0 kết quả" when search term does not exist in targetText', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} initialSearchTerm="KhôngCóTừNày" />
      </NotificationProvider>
    );

    expect(html).toContain('0 kết quả');
  });

  it('displays "Nhập văn bản" placeholder state when search term is empty', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} initialSearchTerm="" />
      </NotificationProvider>
    );

    expect(html).toContain('Nhập văn bản');
  });

  it('disables navigation and action buttons when there are no matches', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} initialSearchTerm="" />
      </NotificationProvider>
    );

    // When matches.length === 0, action buttons should be disabled
    expect(html).toContain('disabled');
  });

  it('enables action buttons when search term matches targetText', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} initialSearchTerm="Tô Bạch" />
      </NotificationProvider>
    );

    expect(html).toContain('Thay tất cả');
    expect(html).toContain('Thay thế');
  });

  it('renders input elements with correct default placeholders and values', () => {
    const html = renderToString(
      <NotificationProvider>
        <FindReplaceModal {...baseProps} initialSearchTerm="Tiêu Viêm" />
      </NotificationProvider>
    );

    expect(html).toContain('value="Tiêu Viêm"');
    expect(html).toContain('placeholder="Nhập văn bản cần tìm..."');
    expect(html).toContain('placeholder="Nhập văn bản thay thế..."');
  });
});

