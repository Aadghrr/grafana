import { css } from 'emotion';
import { GrafanaTheme } from '@grafana/data';
import { styleMixins, stylesFactory } from '../../themes';
import { getScrollbarWidth } from '../../utils';
import { FieldTextAlignment } from './types';
import { ContentPosition } from 'csstype';

export interface GetCellStyleOptions {
  color?: string;
  background?: string;
  align?: FieldTextAlignment;
}

export const getTableStyles = stylesFactory((theme: GrafanaTheme) => {
  const { palette, colors } = theme;
  const headerBg = theme.colors.bg2;
  const borderColor = theme.colors.border1;
  const resizerColor = theme.isLight ? palette.blue95 : palette.blue77;
  const cellPadding = 6;
  const lineHeight = theme.typography.lineHeight.md;
  const bodyFontSize = 14;
  const cellHeight = cellPadding * 2 + bodyFontSize * lineHeight;
  const rowHoverBg = styleMixins.hoverColor(theme.colors.bg1, theme);
  const scollbarWidth = getScrollbarWidth();

  const getCellStyle = (color?: string, background?: string, justify?: ContentPosition) => {
    return css`
      padding: 0 ${cellPadding}px;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      flex: 1;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: ${justify};

      ${color ? `color: ${color};` : ''};
      ${background ? `background: ${background};` : ''};

      &:hover {
        overflow: visible;
        width: auto;
        box-shadow: 0 0 2px ${theme.colors.formFocusOutline};
        background: ${background ?? rowHoverBg};
        z-index: 1;
      }
    `;
  };

  return {
    theme,
    cellHeight,
    getCellStyle,
    cellPadding,
    cellHeightInner: bodyFontSize * lineHeight,
    rowHeight: cellHeight + 2,
    table: css`
      height: 100%;
      width: 100%;
      overflow: auto;
      display: flex;
    `,
    thead: css`
      label: thead;
      height: ${cellHeight}px;
      overflow-y: auto;
      overflow-x: hidden;
      background: ${headerBg};
      position: relative;
    `,
    headerCell: css`
      padding: ${cellPadding}px;
      overflow: hidden;
      white-space: nowrap;
      color: ${colors.textBlue};
      border-right: 1px solid ${theme.colors.panelBg};
      display: flex;

      &:last-child {
        border-right: none;
      }
    `,
    headerCellLabel: css`
      cursor: pointer;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      display: flex;
      margin-right: ${theme.spacing.xs};
    `,
    headerFilter: css`
      label: headerFilter;
      cursor: pointer;
    `,
    row: css`
      label: row;
      border-bottom: 1px solid ${borderColor};

      &:hover {
        background-color: ${rowHoverBg};
      }
    `,
    tableCellWrapper: css`
      border-right: 1px solid ${borderColor};
      display: inline-flex;
      height: 100%;

      &:last-child {
        border-right: none;

        > div {
          padding-right: ${scollbarWidth + cellPadding}px;
        }
      }
    `,
    tableCellLink: css`
      text-decoration: underline;
    `,
    tableCell: getCellStyle(),
    imageCell: css`
      height: 100%;
    `,
    overflow: css`
      overflow: hidden;
      text-overflow: ellipsis;
    `,
    resizeHandle: css`
      label: resizeHandle;
      cursor: col-resize !important;
      display: inline-block;
      background: ${resizerColor};
      opacity: 0;
      transition: opacity 0.2s ease-in-out;
      width: 8px;
      height: 100%;
      position: absolute;
      right: -4px;
      border-radius: 3px;
      top: 0;
      z-index: ${theme.zIndex.dropdown};
      touch-action: none;

      &:hover {
        opacity: 1;
      }
    `,
  };
});

export type TableStyles = ReturnType<typeof getTableStyles>;
