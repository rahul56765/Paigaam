/* Opt-in nested itinerary control. No HTML interpolation of customer copy. */
(function () {
  'use strict';
  window.PaigaamItineraryEditor = function (f, host, addDay, helpers) {
    var make = helpers.make, scalar = helpers.scalarControl, changed = helpers.changed;
    var days = [], maxEvents = 10;
    var headingSpec = f.shape.filter(function (s) { return s.id === 'heading'; })[0];
    var eventsSpec = f.shape.filter(function (s) { return s.id === 'events'; })[0];
    var status = make('p', 'hint');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    host.parentNode.insertBefore(status, host);

    function total() { return days.reduce(function (n, day) { return n + day.entries.length; }, 0); }
    function tools(node, kind) {
      var head = make('div', 'bf-row__head'), label = make('span', 'bf-row__num'), buttons = make('div', 'bf-row__tools');
      function button(text, action) {
        var b = make('button', 'bf-tool', text); b.type = 'button';
        b.setAttribute('aria-label', action + ' ' + kind); buttons.appendChild(b); return b;
      }
      var up = button('↑', 'Move up'), down = button('↓', 'Move down'), remove = button('✕', 'Remove');
      head.appendChild(label); head.appendChild(buttons); node.appendChild(head);
      return { label: label, up: up, down: down, remove: remove };
    }
    function refresh() {
      var count = total();
      status.textContent = days.length + ' / ' + f.maxItems + ' days · ' + count + ' / ' + maxEvents + ' entries total. All entries share one itinerary page.';
      addDay.disabled = days.length >= f.maxItems || count >= maxEvents;
      days.forEach(function (day, i) {
        day.tools.label.textContent = 'Day ' + (i + 1);
        day.tools.up.disabled = i === 0; day.tools.down.disabled = i === days.length - 1;
        day.tools.remove.disabled = days.length <= f.minItems;
        day.add.disabled = count >= maxEvents;
        day.entries.forEach(function (entry, j) {
          entry.tools.label.textContent = 'Entry ' + (j + 1);
          entry.tools.up.disabled = j === 0; entry.tools.down.disabled = j === day.entries.length - 1;
          entry.tools.remove.disabled = day.entries.length <= eventsSpec.minItems;
        });
      });
    }
    function move(items, item, delta, parent) {
      var i = items.indexOf(item), j = i + delta;
      if (i < 0 || j < 0 || j >= items.length) return;
      items.splice(i, 1); items.splice(j, 0, item);
      items.forEach(function (row) { parent.appendChild(row.node); });
      refresh(); changed();
      // Focus stays on an enabled control even at the newly reached boundary.
      item.tools.remove.focus();
    }
    function fieldValue(value, spec) { return typeof value === 'string' ? value.slice(0, spec.maxLength) : ''; }
    function appendEntry(day, value, focus) {
      if (total() >= maxEvents) return;
      var node = make('div', 'bf-row'), entry = { node: node, parts: {} };
      node.setAttribute('data-itinerary-entry', '');
      entry.tools = tools(node, 'entry');
      eventsSpec.shape.forEach(function (sub) {
        var control = scalar(sub, fieldValue(value && value[sub.id], sub), sub.label + ' *');
        entry.parts[sub.id] = control; node.appendChild(control.el);
      });
      day.entries.push(entry); day.list.appendChild(node);
      entry.tools.up.addEventListener('click', function () { move(day.entries, entry, -1, day.list); });
      entry.tools.down.addEventListener('click', function () { move(day.entries, entry, 1, day.list); });
      entry.tools.remove.addEventListener('click', function () {
        if (day.entries.length <= eventsSpec.minItems) return;
        day.entries.splice(day.entries.indexOf(entry), 1); day.list.removeChild(node);
        refresh(); changed(); day.add.focus();
      });
      refresh(); if (focus) entry.parts.time.focus();
    }
    function appendDay(value, focus, blankEntry) {
      if (days.length >= f.maxItems || total() >= maxEvents) return;
      var node = make('div', 'bf-row'), day = { node: node, entries: [] };
      node.setAttribute('data-itinerary-day', '');
      day.tools = tools(node, 'day');
      day.heading = scalar(headingSpec, fieldValue(value && value.heading, headingSpec), headingSpec.label + ' *');
      node.appendChild(day.heading.el);
      day.list = make('div', 'bf-list'); node.appendChild(day.list);
      day.add = make('button', 'button secondary', 'Add an entry'); day.add.type = 'button'; node.appendChild(day.add);
      days.push(day); host.appendChild(node);
      var values = value && Array.isArray(value.events) ? value.events : (blankEntry ? [{}] : []);
      values.slice(0, maxEvents).forEach(function (entry) { appendEntry(day, entry, false); });
      day.tools.up.addEventListener('click', function () { move(days, day, -1, host); });
      day.tools.down.addEventListener('click', function () { move(days, day, 1, host); });
      day.tools.remove.addEventListener('click', function () {
        if (days.length <= f.minItems) return;
        days.splice(days.indexOf(day), 1); host.removeChild(node); refresh(); changed(); addDay.focus();
      });
      day.add.addEventListener('click', function () { appendEntry(day, null, true); changed(); });
      refresh(); if (focus) day.heading.focus();
    }
    function set(value) {
      days = []; host.textContent = '';
      if (Array.isArray(value)) value.slice(0, f.maxItems).forEach(function (day) { appendDay(day, false, false); });
      refresh();
    }
    addDay.addEventListener('click', function () { appendDay(null, true, true); changed(); });
    set(f.default || []);
    return {
      get: function () {
        return days.map(function (day) {
          return { heading: day.heading.get(), events: day.entries.map(function (entry) {
            var out = {}; eventsSpec.shape.forEach(function (sub) { out[sub.id] = entry.parts[sub.id].get(); }); return out;
          }) };
        });
      },
      set: function (value) { set(value); changed(); },
      focus: function () { if (days.length) days[0].heading.focus(); else addDay.focus(); },
      problem: function () {
        if (!days.length) return { message: 'Add at least one itinerary day.', focus: function () { addDay.focus(); } };
        for (var i = 0; i < days.length; i++) {
          var day = days[i];
          if (!day.heading.get()) return { message: 'Day ' + (i + 1) + ' needs a day and date.', focus: day.heading.focus };
          if (!day.entries.length) return { message: 'Day ' + (i + 1) + ' needs an entry.', focus: function () { addDay.focus(); } };
          for (var j = 0; j < day.entries.length; j++) {
            for (var k = 0; k < eventsSpec.shape.length; k++) {
              var sub = eventsSpec.shape[k], part = day.entries[j].parts[sub.id];
              if (!part.get()) return { message: 'Day ' + (i + 1) + ', entry ' + (j + 1) + ' needs a ' + sub.label.toLowerCase() + '.', focus: part.focus };
            }
          }
        }
        return null;
      },
    };
  };
})();
