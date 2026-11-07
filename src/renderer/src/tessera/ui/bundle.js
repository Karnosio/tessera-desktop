/* @ds-bundle: {"format":4,"namespace":"Tessera","components":[{"name":"PowerButton"},{"name":"ConnectionStatus"},{"name":"SelectorCard"},{"name":"Screen"},{"name":"EndpointRow"},{"name":"LatencyBadge"},{"name":"SpeedBadge"},{"name":"OptionRow"},{"name":"ProfileRow"},{"name":"ImportTile"},{"name":"EmptyState"},{"name":"Button"},{"name":"Field"},{"name":"Switch"},{"name":"ListRow"},{"name":"Badge"},{"name":"Callout"},{"name":"Toast"},{"name":"Sheet"},{"name":"Dialog"},{"name":"TopBar"},{"name":"Icon"}]} */
(function () {
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var names = [];
    for (var index = 0; index < arguments.length; index++) {
      if (arguments[index]) names.push(arguments[index]);
    }
    return names.join(' ');
  }

  function omit(source, keys) {
    var result = {};
    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key) && keys.indexOf(key) === -1) result[key] = source[key];
    }
    return result;
  }

  // Геометрия lucide 0.469.0 (ISC): только иконки, которые нужны приложению.
  var ICONS = {
    'arrow-up-down': [['path', { d: 'm21 16-4 4-4-4' }], ['path', { d: 'M17 20V4' }], ['path', { d: 'm3 8 4-4 4 4' }], ['path', { d: 'M7 4v16' }]],
    check: [['path', { d: 'M20 6 9 17l-5-5' }]],
    'chevron-left': [['path', { d: 'm15 18-6-6 6-6' }]],
    'chevron-right': [['path', { d: 'm9 18 6-6-6-6' }]],
    'circle-check': [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'm9 12 2 2 4-4' }]],
    'circle-x': [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'm15 9-6 6' }], ['path', { d: 'm9 9 6 6' }]],
    'clipboard-paste': [['path', { d: 'M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z' }], ['path', { d: 'M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2M11 14h10' }], ['path', { d: 'm17 10 4 4-4 4' }]],
    'ellipsis-vertical': [['circle', { cx: 12, cy: 12, r: 1 }], ['circle', { cx: 12, cy: 5, r: 1 }], ['circle', { cx: 12, cy: 19, r: 1 }]],
    gauge: [['path', { d: 'm12 14 4-4' }], ['path', { d: 'M3.34 19a10 10 0 1 1 17.32 0' }]],
    'file-text': [['path', { d: 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z' }], ['path', { d: 'M14 2v4a2 2 0 0 0 2 2h4' }], ['path', { d: 'M10 9H8' }], ['path', { d: 'M16 13H8' }], ['path', { d: 'M16 17H8' }]],
    'grip-vertical': [['circle', { cx: 9, cy: 12, r: 1 }], ['circle', { cx: 9, cy: 5, r: 1 }], ['circle', { cx: 9, cy: 19, r: 1 }], ['circle', { cx: 15, cy: 12, r: 1 }], ['circle', { cx: 15, cy: 5, r: 1 }], ['circle', { cx: 15, cy: 19, r: 1 }]],
    house: [['path', { d: 'M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8' }], ['path', { d: 'M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }]],
    info: [['circle', { cx: 12, cy: 12, r: 10 }], ['path', { d: 'M12 16v-4' }], ['path', { d: 'M12 8h.01' }]],
    link: [['path', { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' }], ['path', { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }]],
    'loader-circle': [['path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }]],
    pencil: [['path', { d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' }], ['path', { d: 'm15 5 4 4' }]],
    plus: [['path', { d: 'M5 12h14' }], ['path', { d: 'M12 5v14' }]],
    power: [['path', { d: 'M12 2v10' }], ['path', { d: 'M18.4 6.6a9 9 0 1 1-12.77.04' }]],
    'qr-code': [['rect', { width: 5, height: 5, x: 3, y: 3, rx: 1 }], ['rect', { width: 5, height: 5, x: 16, y: 3, rx: 1 }], ['rect', { width: 5, height: 5, x: 3, y: 16, rx: 1 }], ['path', { d: 'M21 16h-3a2 2 0 0 0-2 2v3' }], ['path', { d: 'M21 21v.01' }], ['path', { d: 'M12 7v3a2 2 0 0 1-2 2H7' }], ['path', { d: 'M3 12h.01' }], ['path', { d: 'M12 3h.01' }], ['path', { d: 'M12 16v.01' }], ['path', { d: 'M16 12h1' }], ['path', { d: 'M21 12v.01' }], ['path', { d: 'M12 21v-1' }]],
    'refresh-cw': [['path', { d: 'M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8' }], ['path', { d: 'M21 3v5h-5' }], ['path', { d: 'M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16' }], ['path', { d: 'M8 16H3v5' }]],
    'scan-line': [['path', { d: 'M3 7V5a2 2 0 0 1 2-2h2' }], ['path', { d: 'M17 3h2a2 2 0 0 1 2 2v2' }], ['path', { d: 'M21 17v2a2 2 0 0 1-2 2h-2' }], ['path', { d: 'M7 21H5a2 2 0 0 1-2-2v-2' }], ['path', { d: 'M7 12h10' }]],
    settings: [['path', { d: 'M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
    'trash-2': [['path', { d: 'M3 6h18' }], ['path', { d: 'M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6' }], ['path', { d: 'M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2' }], ['line', { x1: 10, x2: 10, y1: 11, y2: 17 }], ['line', { x1: 14, x2: 14, y1: 11, y2: 17 }]],
    smartphone: [['rect', { width: 14, height: 20, x: 5, y: 2, rx: 2, ry: 2 }], ['path', { d: 'M12 18h.01' }]],
    'triangle-alert': [['path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' }], ['path', { d: 'M12 9v4' }], ['path', { d: 'M12 17h.01' }]],
    x: [['path', { d: 'M18 6 6 18' }], ['path', { d: 'm6 6 12 12' }]],
  };

  function Icon(props) {
    var size = props.size || 20;
    var nodes = ICONS[props.name] || [];
    var labelled = Boolean(props.label);
    return h(
      'svg',
      {
        className: cx('ts-icon', props.spin && 'ts-spin', props.className),
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: props.strokeWidth || 2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        role: labelled ? 'img' : undefined,
        'aria-label': props.label,
        'aria-hidden': labelled ? undefined : 'true',
      },
      nodes.map(function (node, index) {
        return h(node[0], Object.assign({ key: index }, node[1]));
      }),
    );
  }
  Icon.names = Object.keys(ICONS);

  function Button(props) {
    var variant = props.variant || 'default';
    var size = props.size || 'default';
    var small = size === 'sm' || size === 'icon-sm';
    var iconSize = small ? 18 : 20;
    var leading = props.loading ? h(Icon, { name: 'loader-circle', size: iconSize, spin: true }) : props.icon ? h(Icon, { name: props.icon, size: iconSize }) : null;
    var rest = omit(props, ['variant', 'size', 'block', 'loading', 'icon', 'iconEnd', 'className', 'children']);
    return h(
      'button',
      Object.assign({ type: 'button' }, rest, {
        className: cx('ts-btn', small ? 't-control-sm' : 't-control', props.className),
        'data-variant': variant,
        'data-size': size,
        'data-block': props.block ? '' : undefined,
        'aria-busy': props.loading ? 'true' : undefined,
        disabled: props.disabled || props.loading,
      }),
      leading,
      props.children,
      props.iconEnd ? h(Icon, { name: props.iconEnd, size: iconSize }) : null,
    );
  }

  var POWER_ICON = { off: 'power', connecting: 'power', on: 'power', error: 'power', disabled: 'power' };
  var POWER_LABEL = { off: 'Включить', connecting: 'Отменить включение', on: 'Выключить', error: 'Включить снова', disabled: 'Сначала добавьте профиль' };

  function PowerButton(props) {
    var state = props.state || 'off';
    var labels = Object.assign({}, POWER_LABEL, props.labels);
    var rest = omit(props, ['state', 'labels', 'className']);
    return h(
      'button',
      Object.assign({ type: 'button' }, rest, {
        className: cx('ts-power', props.className),
        'data-state': state,
        'aria-label': labels[state],
        'aria-pressed': state === 'on' ? 'true' : 'false',
        'aria-busy': state === 'connecting' ? 'true' : undefined,
        disabled: state === 'disabled' || props.disabled,
      }),
      state === 'connecting'
        ? h(
            'svg',
            { className: 'ts-power-ring', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
            h('circle', { className: 'ts-power-track', cx: 50, cy: 50, r: 48 }),
            h('circle', { className: 'ts-power-arc', cx: 50, cy: 50, r: 48 }),
          )
        : null,
      h(Icon, { name: POWER_ICON[state], size: 64, strokeWidth: 2.25 }),
    );
  }

  // Крупно — что произойдёт по нажатию, мелко — что происходит сейчас.
  var STATUS_TITLE = { off: 'Включить', connecting: 'Включается…', on: 'Выключить', error: 'Включить снова', disabled: 'Добавьте профиль' };
  var STATUS_DETAIL = { off: 'Сейчас выключено', connecting: 'Нажмите, чтобы отменить', on: 'Сейчас включено', error: 'Не получилось включить', disabled: 'Без профиля включить нельзя' };

  function ConnectionStatus(props) {
    var state = props.state || 'off';
    return h(
      'div',
      { className: cx('ts-status', props.className), 'data-state': state, role: 'status', 'aria-live': 'polite' },
      h('p', { className: 'ts-status-title t-display' }, props.title || STATUS_TITLE[state]),
      h('p', { className: 'ts-status-detail t-secondary' }, props.detail || STATUS_DETAIL[state]),
    );
  }

  function SelectorCard(props) {
    return h(
      'div',
      { className: cx('ts-selector', props.className) },
      (props.rows || []).map(function (row, index) {
        return h(
          'button',
          { key: row.label || index, type: 'button', className: 'ts-selector-row', onClick: row.onClick },
          h(
            'span',
            { className: 'ts-selector-text' },
            h('span', { className: 'ts-label t-label' }, row.label),
            h('span', { className: 'ts-truncate t-body-strong' }, row.value),
          ),
          row.meta || null,
          h(Icon, { name: 'chevron-right', size: 20, className: 'ts-chevron' }),
        );
      }),
    );
  }

  var BADGE_VARIANTS = ['default', 'secondary', 'outline', 'accent', 'success', 'warning', 'destructive', 'muted'];

  function Badge(props) {
    var variant = BADGE_VARIANTS.indexOf(props.variant) === -1 ? 'default' : props.variant;
    return h(
      'span',
      { className: cx('ts-badge t-caption', props.className), 'data-variant': variant },
      props.icon ? h(Icon, { name: props.icon, size: 14 }) : null,
      props.children,
    );
  }

  var LATENCY_TEXT = { good: 'Быстро', slow: 'Медленно', dead: 'Не отвечает', unknown: 'Не проверен', testing: 'Проверяем…' };

  function LatencyMark(props) {
    var state = props.state;
    if (state === 'testing') return h(Icon, { name: 'loader-circle', size: 14, spin: true });
    var children;
    if (state === 'good') children = h('circle', { cx: 6, cy: 6, r: 5, fill: 'currentColor' });
    if (state === 'slow') {
      children = [
        h('circle', { key: 'ring', cx: 6, cy: 6, r: 4.25, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 }),
        h('path', { key: 'half', d: 'M6 1.75a4.25 4.25 0 0 0 0 8.5z', fill: 'currentColor' }),
      ];
    }
    if (state === 'dead') children = h('path', { d: 'M2.5 2.5l7 7M9.5 2.5l-7 7', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' });
    if (state === 'unknown') children = h('circle', { cx: 6, cy: 6, r: 4.25, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5 });
    return h('svg', { className: 'ts-latency-mark', viewBox: '0 0 12 12', 'aria-hidden': 'true' }, children);
  }

  function LatencyBadge(props) {
    var state = props.state || 'unknown';
    var labels = Object.assign({}, LATENCY_TEXT, props.labels);
    var unit = ' ' + (props.unit || 'мс');
    var measured = state === 'good' || state === 'slow';
    var text = measured ? (props.compact ? props.ms + unit : labels[state] + ' · ' + props.ms + unit) : labels[state];
    return h('span', { className: cx('ts-latency t-numeric', props.className), 'data-state': state }, h(LatencyMark, { state: state }), text);
  }

  var SPEED_TEXT = { none: 'Замерить скорость', testing: 'Замеряем…', unavailable: 'Нельзя замерить' };

  function SpeedBadge(props) {
    var state = props.state || 'none';
    var labels = Object.assign({}, SPEED_TEXT, props.labels);
    var text = state === 'done' ? props.mbps + ' ' + (props.unit || 'Мбит/с') : labels[state];
    return h(
      'span',
      { className: cx('ts-speed t-numeric', props.className), 'data-state': state },
      h(Icon, { name: state === 'testing' ? 'loader-circle' : 'gauge', size: 14, spin: state === 'testing' }),
      text,
    );
  }

  function Radio(props) {
    return h('span', { className: 'ts-radio', 'aria-hidden': 'true' }, props.checked ? h(Icon, { name: 'check', size: 14, strokeWidth: 3 }) : null);
  }

  function OptionRow(props) {
    return h(
      'button',
      { type: 'button', role: 'radio', 'aria-checked': props.selected ? 'true' : 'false', className: cx('ts-option', props.className), onClick: props.onClick },
      h(Radio, { checked: props.selected }),
      props.media ? h('span', { className: 'ts-option-media', 'aria-hidden': 'true' }, props.media) : null,
      h(
        'span',
        { className: 'ts-endpoint-text' },
        h('span', { className: 't-body-strong' }, props.title),
        props.description ? h('span', { className: 'ts-endpoint-detail t-secondary' }, props.description) : null,
      ),
    );
  }

  function EndpointRow(props) {
    var speed = props.speed;
    var speedLabel = speed && speed.state === 'done' ? 'Замерить скорость снова: ' + props.name : 'Замерить скорость: ' + props.name;
    return h(
      'div',
      { className: cx('ts-endpoint', props.className), 'data-selected': props.selected ? '' : undefined },
      h(
        'button',
        { type: 'button', role: 'radio', 'aria-checked': props.selected ? 'true' : 'false', className: 'ts-endpoint-main', onClick: props.onClick },
        h(Radio, { checked: props.selected }),
        h(
          'span',
          { className: 'ts-endpoint-text' },
          h('span', { className: 'ts-truncate t-body' }, props.name),
          props.detail ? h('span', { className: 'ts-endpoint-detail t-secondary' }, props.detail) : null,
        ),
      ),
      props.latency || speed
        ? h(
            'span',
            { className: 'ts-endpoint-metrics' },
            props.latency ? h(LatencyBadge, Object.assign({ compact: Boolean(speed) }, props.latency)) : null,
            speed
              ? h(
                  'button',
                  {
                    type: 'button',
                    className: 'ts-speed-button',
                    onClick: props.onSpeedTest,
                    disabled: speed.state === 'testing' || speed.state === 'unavailable',
                    'aria-label': speed.state === 'testing' || speed.state === 'unavailable' ? undefined : speedLabel,
                  },
                  h(SpeedBadge, speed),
                )
              : null,
          )
        : null,
    );
  }

  function ProfileRow(props) {
    var actions = props.actions || [];
    return h(
      'div',
      { className: cx('ts-profile', props.className), 'data-selected': props.selected ? '' : undefined },
      h(
        'div',
        { className: 'ts-profile-head' },
        props.reorderable ? h('span', { className: 'ts-profile-grip', 'aria-hidden': 'true' }, h(Icon, { name: 'grip-vertical', size: 20 })) : null,
        h(
          'button',
          { type: 'button', role: 'radio', 'aria-checked': props.selected ? 'true' : 'false', className: 'ts-profile-main', onClick: props.onClick },
          h(Radio, { checked: props.selected }),
          h(
            'span',
            { className: 'ts-profile-text' },
            h('span', { className: 'ts-truncate t-body-strong' }, props.name),
            props.meta ? h('span', { className: 'ts-profile-meta t-secondary' }, props.meta) : null,
            props.badges && props.badges.length
              ? h(
                  'span',
                  { className: 'ts-profile-badges' },
                  props.badges.map(function (badge, index) {
                    return h(Badge, Object.assign({ key: index }, badge), badge.text);
                  }),
                )
              : null,
          ),
        ),
        h(Button, { variant: 'ghost', size: 'icon-sm', icon: 'ellipsis-vertical', 'aria-label': props.menuLabel || 'Действия с профилем', 'aria-expanded': actions.length ? 'true' : 'false', onClick: props.onMenu }),
      ),
      actions.length
        ? h(
            'div',
            { className: 'ts-profile-actions' },
            actions.map(function (action, index) {
              return h(Button, { key: index, size: 'sm', variant: action.destructive ? 'destructive' : 'secondary', icon: action.icon, onClick: action.onClick }, action.label);
            }),
          )
        : null,
    );
  }

  function ImportTile(props) {
    return h(
      'button',
      { type: 'button', className: cx('ts-tile', props.className), 'data-emphasis': props.emphasis ? '' : undefined, onClick: props.onClick },
      h('span', { className: 'ts-tile-icon' }, h(Icon, { name: props.icon, size: 24 })),
      h(
        'span',
        { className: 'ts-tile-text' },
        h('span', { className: 't-body-strong' }, props.title),
        props.description ? h('span', { className: 'ts-tile-description t-secondary' }, props.description) : null,
      ),
    );
  }

  function ImportTileGrid(props) {
    return h('div', { className: cx('ts-tile-grid', props.className) }, props.children);
  }

  function ListGroup(props) {
    return h(
      'section',
      { className: cx('ts-list-group', props.className) },
      props.title ? h('h3', { className: 'ts-list-group-title ts-label t-label' }, props.title) : null,
      h('div', { className: 'ts-list' }, props.children),
    );
  }

  function Switch(props) {
    var rest = omit(props, ['checked', 'onChange', 'className']);
    return h(
      'button',
      Object.assign({ type: 'button', role: 'switch' }, rest, {
        className: cx('ts-switch', props.className),
        'aria-checked': props.checked ? 'true' : 'false',
        onClick: function () {
          if (props.onChange) props.onChange(!props.checked);
        },
      }),
      h('span', { className: 'ts-switch-thumb' }),
    );
  }

  function ListRow(props) {
    var trailing = props.trailing;
    if (props.switch) trailing = h(Switch, Object.assign({ 'aria-label': props.title }, props.switch));
    else if (props.chevron !== false && props.onClick) trailing = h(React.Fragment, null, props.value ? h('span', { className: 'ts-row-value t-secondary' }, props.value) : null, h(Icon, { name: 'chevron-right', size: 20, className: 'ts-chevron' }));
    else if (props.value) trailing = h('span', { className: 'ts-row-value t-secondary' }, props.value);
    var content = [
      props.icon ? h('span', { key: 'icon', className: 'ts-row-icon' }, h(Icon, { name: props.icon, size: 20 })) : null,
      h(
        'span',
        { key: 'text', className: 'ts-row-text' },
        h('span', { className: 't-body' }, props.title),
        props.description ? h('span', { className: 'ts-row-description t-secondary' }, props.description) : null,
      ),
      trailing ? h(React.Fragment, { key: 'trailing' }, trailing) : null,
    ];
    var common = { className: cx('ts-row', props.className), 'data-destructive': props.destructive ? '' : undefined };
    if (props.onClick) return h('button', Object.assign({ type: 'button', onClick: props.onClick }, common), content);
    return h('div', common, content);
  }

  function Input(props) {
    var rest = omit(props, ['invalid', 'className']);
    return h('input', Object.assign({ type: 'text' }, rest, { className: cx('ts-input t-body', props.className), 'aria-invalid': props.invalid ? 'true' : undefined }));
  }

  function Field(props) {
    var id = props.id;
    var descriptionId = id + '-description';
    var errorId = id + '-error';
    var describedBy = cx(props.description && descriptionId, props.error && errorId) || undefined;
    var control = props.children || h(Input, Object.assign({ id: id, invalid: Boolean(props.error), 'aria-describedby': describedBy }, props.input));
    return h(
      'div',
      { className: cx('ts-field', props.className) },
      h('label', { className: 'ts-field-label t-control-sm', htmlFor: id }, props.label),
      control,
      props.description && !props.error ? h('p', { id: descriptionId, className: 'ts-field-description t-secondary' }, props.description) : null,
      props.error ? h('p', { id: errorId, className: 'ts-field-error t-secondary' }, h(Icon, { name: 'circle-x', size: 16 }), props.error) : null,
    );
  }

  var CALLOUT_ICON = { info: 'info', success: 'circle-check', warning: 'triangle-alert', destructive: 'circle-x' };

  function Callout(props) {
    var tone = props.tone || 'info';
    return h(
      'div',
      { className: cx('ts-callout', props.className), 'data-tone': tone, role: tone === 'destructive' ? 'alert' : undefined },
      h(Icon, { name: props.icon || CALLOUT_ICON[tone], size: 20 }),
      h(
        'div',
        { className: 'ts-callout-body' },
        props.title ? h('p', { className: 'ts-callout-title t-body-strong' }, props.title) : null,
        props.children ? h('p', { className: 'ts-callout-text t-secondary' }, props.children) : null,
        props.action ? h('div', { className: 'ts-callout-action' }, props.action) : null,
      ),
    );
  }

  var TOAST_ICON = { info: 'info', success: 'circle-check', destructive: 'circle-x' };

  function Toast(props) {
    var tone = props.tone || 'info';
    return h(
      'div',
      { className: cx('ts-toast', props.className), 'data-tone': tone, role: 'status' },
      h(Icon, { name: TOAST_ICON[tone], size: 20 }),
      h('p', { className: 'ts-toast-text t-secondary' }, props.children),
      props.action ? h(Button, { variant: 'ghost', size: 'sm', onClick: props.action.onClick }, props.action.label) : null,
    );
  }

  function Sheet(props) {
    var titleId = props.id ? props.id + '-title' : undefined;
    return h(
      'div',
      { className: cx('ts-sheet', props.className), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h('span', { className: 'ts-sheet-grabber', 'aria-hidden': 'true' }),
      props.title || props.description
        ? h(
            'div',
            { className: 'ts-sheet-header' },
            props.title ? h('h2', { id: titleId, className: 'ts-sheet-title t-heading' }, props.title) : null,
            props.description ? h('p', { className: 'ts-sheet-description t-secondary' }, props.description) : null,
          )
        : null,
      h('div', { className: 'ts-sheet-body' }, props.children),
      props.footer ? h('div', { className: 'ts-sheet-footer' }, props.footer) : null,
    );
  }

  function Dialog(props) {
    var titleId = props.id ? props.id + '-title' : undefined;
    return h(
      'div',
      { className: cx('ts-dialog', props.className), role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': titleId },
      h(
        'div',
        { className: 'ts-dialog-header' },
        h('h2', { id: titleId, className: 'ts-dialog-title t-heading' }, props.title),
        props.description ? h('p', { className: 'ts-dialog-description t-secondary' }, props.description) : null,
      ),
      props.children,
      props.actions ? h('div', { className: 'ts-dialog-actions' }, props.actions) : null,
    );
  }

  function Scrim(props) {
    return h('div', { className: cx('ts-scrim', props.className), 'data-center': props.center ? '' : undefined }, props.children);
  }

  function TopBar(props) {
    return h(
      'header',
      { className: cx('ts-topbar', props.className), 'data-back': props.onBack ? '' : undefined },
      props.onBack ? h(Button, { variant: 'ghost', size: 'icon', icon: 'chevron-left', 'aria-label': props.backLabel || 'Назад', onClick: props.onBack }) : null,
      props.title ? h('h1', { className: 'ts-topbar-title ts-truncate t-title' }, props.title) : null,
      props.actions ? h('div', { className: 'ts-topbar-actions' }, props.actions) : null,
    );
  }

  function EmptyState(props) {
    return h(
      'div',
      { className: cx('ts-empty', props.className) },
      h('span', { className: 'ts-empty-icon' }, h(Icon, { name: props.icon || 'plus', size: 32 })),
      h('h2', { className: 'ts-empty-title t-title' }, props.title),
      props.description ? h('p', { className: 'ts-empty-description t-secondary' }, props.description) : null,
      props.actions ? h('div', { className: 'ts-empty-actions' }, props.actions) : null,
    );
  }

  function Screen(props) {
    return h(
      'div',
      {
        className: cx('ts-screen', props.className),
        style: props.style,
        'data-grid': props.grid ? '' : undefined,
        'data-ground': props.ground || 'paper',
      },
      props.top || null,
      h('div', { className: 'ts-screen-body', style: props.bodyStyle }, props.children),
      props.overlay || null,
    );
  }

  window.Tessera = Object.assign(window.Tessera || {}, {
    Badge: Badge,
    Button: Button,
    Callout: Callout,
    ConnectionStatus: ConnectionStatus,
    Dialog: Dialog,
    EmptyState: EmptyState,
    EndpointRow: EndpointRow,
    Field: Field,
    Icon: Icon,
    ImportTile: ImportTile,
    ImportTileGrid: ImportTileGrid,
    Input: Input,
    LatencyBadge: LatencyBadge,
    ListGroup: ListGroup,
    ListRow: ListRow,
    OptionRow: OptionRow,
    PowerButton: PowerButton,
    ProfileRow: ProfileRow,
    Scrim: Scrim,
    Screen: Screen,
    SelectorCard: SelectorCard,
    Sheet: Sheet,
    SpeedBadge: SpeedBadge,
    Switch: Switch,
    Toast: Toast,
    TopBar: TopBar,
  });
})();
