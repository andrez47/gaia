'use strict';

var _ = navigator.mozL10n.get;

var Recents = {
  DBNAME: 'dialerRecents',
  STORENAME: 'dialerRecents',

  _recentsEditionMode: false,

  get headerEditModeText() {
    delete this.headerEditModeText;
    return this.headerEditModeText = document.
                                    getElementById('header-edit-mode-text');
  },

  get recentsIconEdit() {
    delete this.recentsIconEdit;
    return this.recentsIconEdit = document.getElementById('edit-button');
  },

  get recentsIconClose() {
    delete this.recentsIconClose;
    return this.recentsIconClose = document.getElementById('cancel-button');
  },

  get recentsIconDelete() {
    delete this.recentsIconDelete;
    return this.recentsIconDelete = document.getElementById('delete-button');
  },

  get recentsContainer() {
    delete this.recentsContainer;
    return this.recentsContainer = document.getElementById('recents-container');
  },

  get recentsView() {
    delete this.recentsView;
    return this.recentsView = document.getElementById('recents-view');
  },

  get recentsFilterContainer() {
    delete this.recentsFilterContainer;
    return this.recentsFilterContainer = document.getElementById(
      'recents-filter-container');
  },

  get allFilter() {
    delete this.allFilter;
    return this.allFilter = document.getElementById('allFilter');
  },

  get missedFilter() {
    delete this.missedFilter;
    return this.missedFilter = document.getElementById('missedFilter');
  },

  get deselectAllThreads() {
    delete this.deselectAllThreads;
    return this.deselectAllThreads = document.
      getElementById('deselect-all-threads');
  },

  get selectAllThreads() {
    delete this.selectAllThreads;
    return this.selectAllThreads = document.
      getElementById('select-all-threads');
  },

  init: function re_init() {
    if (this.recentsFilterContainer) {
      this.recentsFilterContainer.addEventListener('click',
        this.filter.bind(this));
    }
    if (this.recentsIconEdit) {
      this.recentsIconEdit.addEventListener('click',
        this.recentsHeaderAction.bind(this));
    }
    if (this.recentsIconClose) {
      this.recentsIconClose.addEventListener('click',
        this.recentsHeaderAction.bind(this));
    }
    if (this.recentsIconDelete) {
      this.recentsIconDelete.addEventListener('click',
        this.recentsHeaderAction.bind(this));
    }
    if (this.deselectAllThreads) {
      this.deselectAllThreads.addEventListener('click',
        this.deselectSelectedEntries.bind(this));
    }
    if (this.selectAllThreads) {
      this.selectAllThreads.addEventListener('click',
        this.selectAllEntries.bind(this));
    }

    var indexedDB = window.indexedDB || window.webkitIndexedDB ||
        window.mozIndexedDB || window.msIndexedDB;

    this._openreq = indexedDB.open(this.DBNAME);

    var self = this;
    this._openreq.onsuccess = function re_dbOnSuccess() {
      self._recentsDB = self._openreq.result;
    };

    this._openreq.onerror = function re_dbOnError(e) {
      console.log('Can\'t open dialerRecents database', e);
    };

    // DB init
    this._openreq.onupgradeneeded = function re_onUpgradeNeeded() {
      var db = self._openreq.result;
      if (db.objectStoreNames.contains(self.STORENAME))
        db.deleteObjectStore(self.STORENAME);
      db.createObjectStore(self.STORENAME, { keyPath: 'date' });
    };

    this._cachedContacts = new Object();
    this.render();
  },

  recentsHeaderAction: function re_recentsIconEditAction(event) {
    if (event) {
      var toggleEditionMode = true;
      switch (event.target ? event.target.id : event) {
        case 'edit-button': // Entering edit mode
          // Updating header
          this.headerEditModeText.textContent = _('edit');
          this.deselectSelectedEntries();
          break;
        case 'cancel-button': // Exit edit mode with no deletions
          var query = '.log-item.hide.selected';
          var elements = this.recentsContainer.querySelectorAll(query);
          // Show hidden messages
          for (var i = 0; i < elements.length; i++) {
            elements[i].classList.remove('hide');
          }
          this.deselectSelectedEntries();
          break;
        case 'delete-button': // Commit deletions and exit edit mode
          // Execute deletion of the lists
          if (this.executeDeletion()) {
            this.render();
          } else {
            toggleEditionMode = false;
          }
          break;
      }
    }
    if (toggleEditionMode) {
      this.recentsView.classList.toggle('recents-edit');
      this._recentsEditionMode = !this._recentsEditionMode;
    }
  },

  filter: function re_filter(event) {
    // do nothing if selected tab is same that current
    if (event.target.classList.contains('selected')) {
      return;
    }
    var action = event.target.dataset.action;
    var noMissedCallsSelector = '.log-item[data-type^=dialing]' +
      ':not(.collapsed), ' +
      '.log-item[data-type=incoming-connected]:not(.collapsed)';
    var noMissedCallsItems = document.querySelectorAll(noMissedCallsSelector);
    var noMissedCallsLength = noMissedCallsItems.length;
    var i;
    var allCalls = (action == 'all');
    if (allCalls) {
      for (i = 0; i < noMissedCallsLength; i++) {
        var noMissedCallsItem = noMissedCallsItems[i];
        var noMissedCallsDay = noMissedCallsItem.parentNode.parentNode;
        noMissedCallsDay.classList.remove('hide');
        noMissedCallsItem.classList.remove('hide');
      }
      var visibleCalls = this.recentsContainer.
        querySelectorAll('.log-item:not(.hide)');
      if (visibleCalls.length > 0) {
        this.recentsIconEdit.classList.remove('disabled');
      } else {
        this.recentsIconEdit.classList.add('disabled');
      }
      if (this._recentsEditionMode) {
        var selectedCalls = this.recentsContainer.
          querySelectorAll('.log-item:not(.hide).selected');
        var selectedCallsLength = selectedCalls.length;
        if (selectedCallsLength == 0) {
          this.headerEditModeText.textContent = _('edit');
        } else {
          this.headerEditModeText.textContent = _('edit-selected',
                                                  {n: selectedCallsLength});
        }
      }
      if (this._allViewGroupingPending) {
        this.groupCallsInCallLog();
        this._allViewGroupingPending = false;
        this._missedViewGroupingPending = false;
      }
    } else {
      for (i = 0; i < noMissedCallsLength; i++) {
        var noMissedCallsItem = noMissedCallsItems[i];
        noMissedCallsItem.classList.add('hide');
        var noMissedCallsItemParent = noMissedCallsItem.parentNode;
        var notHiddenCalls = noMissedCallsItemParent.
          querySelectorAll('.log-item:not(.hide)');
        if (notHiddenCalls.length == 0) {
          var notHiddenCallsDay = noMissedCallsItemParent.parentNode;
          notHiddenCallsDay.classList.add('hide');
        }
        var visibleCalls = this.recentsContainer.
          querySelectorAll('.log-item:not(.hide)');
        if (visibleCalls.length == 0) {
          this.recentsIconEdit.classList.add('disabled');
        } else {
          this.recentsIconEdit.classList.remove('disabled');
        }
        if (this._recentsEditionMode) {
          var selectedCalls = this.recentsContainer.
            querySelectorAll('.log-item:not(.hide).selected');
          var selectedCallsLength = selectedCalls.length;
          if (selectedCallsLength == 0) {
            this.headerEditModeText.textContent = _('edit');
          } else {
            this.headerEditModeText.textContent = _('edit-selected',
                                                    {n: selectedCallsLength});
          }
        }
      }
      if (this._missedViewGroupingPending) {
        this.groupCallsInCallLog();
        this._missedViewGroupingPending = false;
      }
    }
    this.allFilter.classList.toggle('selected');
    this.missedFilter.classList.toggle('selected');
    if (this._recentsEditionMode)
      this.recentsHeaderAction('cancel-button');
  },

  cleanup: function re_cleanup() {
    if (this._recentsDB)
      this._recentsDB.close();
  },

  getDatabase: function re_getDatabase(callback) {
    var self = this;
    if (!this._recentsDB) {
      this._openreq.addEventListener('success', function re_DBReady() {
        self._openreq.removeEventListener('success', re_DBReady);
        self.getDatabase(callback);
      });
      return;
    }

    callback(this._recentsDB);
  },

  add: function re_add(recentCall) {
    var self = this;

    this.getDatabase(function(database) {
      var txn = database.transaction(self.STORENAME, 'readwrite');
      var store = txn.objectStore(self.STORENAME);

      var setreq = store.put(recentCall);
      setreq.onsuccess = function sr_onsuccess() {
        // TODO At some point with we will be able to get the app window
        // to update the view. Relying on visibility changes until then.
        // (and doing a full re-render)
      };

      setreq.onerror = function(e) {
        console.log('dialerRecents add failure: ', e.message, setreq.errorCode);
      };
    });
  },

  deleteAll: function re_deleteAll() {
    var response = window.confirm(_('confirm-deletion'));
    if (response) {
      var self = this;

      this.getDatabase(function(database) {
        var txn = database.transaction(self.STORENAME, 'readwrite');
        var store = txn.objectStore(self.STORENAME);

        var delAllReq = store.clear();
        delAllReq.onsuccess = function da_onsuccess() {
          self.render();
          self.recentsHeaderAction(null);
        };

        delAllReq.onerror = function da_onerror(e) {
          console.log('dialerRecents delete all failure: ',
            e.message, setreq.errorCode);
        };
      });
    }
  },

  selectAllEntries: function re_selectAllEntries() {
    var itemSelector = '.log-item';
    var items = document.querySelectorAll(itemSelector);
    var length = items.length;
    for (var i = 0; i < length; i++) {
      items[i].classList.add('selected');
    }
    var count = this.getSelectedEntries().length;
    this.headerEditModeText.textContent = _('edit-selected',
                                            {n: count});
    this.recentsIconDelete.classList.remove('disabled');
  },

  deselectSelectedEntries: function re_deselectSelectedEntries() {
    var itemSelector = '.log-item.selected';
    var items = document.querySelectorAll(itemSelector);
    var length = items.length;
    for (var i = 0; i < length; i++) {
      items[i].classList.remove('selected');
    }
    this.headerEditModeText.textContent = _('edit');
    this.recentsIconDelete.classList.add('disabled');
  },

  executeDeletion: function re_executeDeletion() {
    var response = window.confirm(_('confirm-deletion'));
    if (response) {
      var self = this;

      this.getDatabase(function(database) {
        var txn = database.transaction(self.STORENAME, 'readwrite'),
          store = txn.objectStore(self.STORENAME),
          selectedEntries = self.getSelectedEntries(),
          selectedLength = selectedEntries.length,
          entriesInGroup, entriesInGroupLength;
        for (var i = 0; i < selectedLength; i++) {
          entriesInGroup = self.getEntriesInGroup(selectedEntries[i]);
          entriesInGroupLength = entriesInGroup.length;
          for (var j = 0; j < entriesInGroupLength; j++) {
            self.deleteEntry(store, entriesInGroup[j]);
          }
        }
      });
    }
    return response;
  },

  getSameTypeCallsOnSameDay: function re_getSameTypeCallsOnSameDay(
    day, phoneNumber, phoneNumberType, callType, startingWith) {
    var groupSelector = '[data-num^="' + phoneNumber +
      '"]' + (phoneNumberType ? ('[data-phone-type="' +
      phoneNumberType + '"]') : '') +
      '[data-type' + (startingWith ? '^' : '') + '="' + callType + '"]';
    return day.querySelectorAll(groupSelector);
  },

  getMostRecentCallWithSameTypeOnSameDay:
    function getMostRecentCallWithSameTypeOnSameDay(
      day, phoneNumber, phoneNumberType, callType, startingWith) {
    var groupSelector = '[data-num^="' + phoneNumber +
      '"]' + (phoneNumberType ? ('[data-phone-type="' +
      phoneNumberType + '"]') : '') +
      '[data-type' + (startingWith ? '^' : '') + '="' + callType +
      '"][data-count]:not(.hide)';
    return day.querySelector(groupSelector);
  },

  getEntriesInGroup: function re_getEntriesInGroup(logItem) {
    var entriesInGroup = new Array(),
    groupItemLogs, groupItemLogsAux,
      callType = logItem.dataset.type,
      phoneNumber = logItem.dataset.num.trim(),
      phoneNumberType = logItem.dataset.phoneType,
      sameDaySection = logItem.parentNode;
    if (callType.indexOf('dialing') != -1) {
      groupItemLogs = this.getSameTypeCallsOnSameDay(
        sameDaySection, phoneNumber, phoneNumberType, 'dialing', true);
    } else if (callType.indexOf('incoming-connected') != -1) {
      groupItemLogs = this.getSameTypeCallsOnSameDay(
        sameDaySection, phoneNumber, phoneNumberType,
          'incoming-connected', false);
    } else {
      groupItemLogs = this.getSameTypeCallsOnSameDay(
        sameDaySection, phoneNumber, phoneNumberType, 'incoming', false);
      groupItemLogsAux = this.getSameTypeCallsOnSameDay(
        sameDaySection, phoneNumber, phoneNumberType, 'incoming-refused',
          false);
    }
    if (groupItemLogs && groupItemLogs.length > 0) {
      for (var i = 0; i < groupItemLogs.length; i++) {
        entriesInGroup.push(groupItemLogs[i]);
      }
    }
    if (groupItemLogsAux && groupItemLogsAux.length > 0) {
      for (var i = 0; i < groupItemLogsAux.length; i++) {
        entriesInGroup.push(groupItemLogsAux[i]);
      }
    }
    return entriesInGroup;
  },

  deleteEntry: function re_deleteEntry(store, logItem) {
    var delSelReq = store.delete(parseInt(logItem.dataset.date));

    delSelReq.onsuccess = function ds_onsuccess(deletedLogItem, e) {
      var deletedLogItemParent = deletedLogItem.parentNode;
      deletedLogItemParent.removeChild(deletedLogItem);
      if (deletedLogItemParent.childNodes.length == 0) {
        var deletedLogItemDay = deletedLogItemParent.parentNode;
        var deletedLogItemDayParent = deletedLogItemDay.parentNode;
        deletedLogItemDayParent.removeChild(deletedLogItemDay);
        if (this.recentsContainer.innerHTML == '') {
          this.recentsIconEdit.classList.add('disabled');
        }
      } else if (this.missedFilter.classList.contains('selected')) {
        var notHiddenCalls = deletedLogItemParent.
          querySelectorAll('.log-item:not(.hide)');
        if (notHiddenCalls.length == 0) {
          var notHiddenCallsDay = deletedLogItemParent.parentNode;
          notHiddenCallsDay.classList.add('hide');
        }
        var visibleCalls = this.recentsContainer.
          querySelectorAll('.log-item:not(.hide)');
        if (visibleCalls.length == 0) {
          this.recentsIconEdit.classList.add('disabled');
        }
      }
    }.bind(this, logItem);

    delSelReq.onerror = function ds_onerror(e) {
      console.log('dialerRecents delete selected failure: ',
        e.message, setreq.errorCode);
    }
  },

  click: function re_click(target) {
    if (!target.classList.contains('log-item')) {
      return;
    }
    if (!this._recentsEditionMode) {
      var number = target.dataset.num.trim();
      if (number) {
        this.updateLatestVisit();
        CallHandler.call(number);
      }
    } else {
      target.classList.toggle('selected');
      var count = this.getSelectedEntries().length;
      if (count == 0) {
        this.headerEditModeText.textContent = _('edit');
        this.recentsIconDelete.classList.add('disabled');
      } else {
        this.headerEditModeText.textContent = _('edit-selected',
                                                {n: count});
        this.recentsIconDelete.classList.remove('disabled');
      }
    }
  },

  getSelectedEntries: function re_getSelectedGroups() {
    var itemSelector = '.log-item.selected';
    var items = document.querySelectorAll(itemSelector);
    return items;
  },

  createRecentEntry: function re_createRecentEntry(recent) {
    var classes = 'icon ';
    if (recent.type.indexOf('dialing') != -1) {
      classes += 'icon-outgoing';
    } else if (recent.type.indexOf('incoming') != -1) {
      if (recent.type.indexOf('connected') == -1) {
        classes += 'icon-missed';
      } else {
        classes += 'icon-incoming';
      }
    }
    var entry =
      '<li class="log-item ' +
        ((localStorage.getItem('latestCallLogVisit') < recent.date) ?
          'highlighted' : '') +
      '  " data-num="' + recent.number +
      '  " data-date="' + recent.date +
      '  " data-type="' + recent.type + '">' +
      '  <section class="call-log-selection ' +
           '">' +
      '  </section>' +
      '  <section class="icon-container grid center">' +
      '    <div class="grid-cell grid-v-align">' +
      '      <div class="call-type-icon ' + classes + '"></div>' +
      '    </div>' +
      '  </section>' +
      '  <section class="log-item-info grid">' +
      '    <div class="grid-cell grid-v-align">' +
      '      <section class="primary-info ellipsis">' +
               recent.number +
      '      </section>' +
      '      <section class="secondary-info ellipsis">' +
               prettyDate(recent.date) +
      '      </section>' +
      '    </div>' +
      '  </section>' +
      '  <section class="call-log-contact-photo' + '">' +
      '  </section>' +
      '</li>';
    return entry;
  },

  render: function re_render() {
    if (!this.recentsContainer)
      return;

    var self = this;
    this.history(function showRecents(recents) {
      if (recents.length == 0) {
        self.recentsContainer.innerHTML =
          '<div id="no-result-container">' +
          ' <div id="no-result-message">' +
          '   <p data-l10n-id="no-logs-msg-1">no calls recorded</p>' +
          '   <p data-l10n-id="no-logs-msg-2">start communicating now</p>' +
          ' </div>' +
          '</div>';
        self.recentsIconEdit.classList.add('disabled');
        return;
      }

      self.recentsIconEdit.classList.remove('disabled');
      var content = '',
        currentDay = '';
      for (var i = 0; i < recents.length; i++) {
        var day = self.getDayDate(recents[i].date);
        if (day != currentDay) {
          if (currentDay != '') {
            content += '</ol></section>';
          }
          currentDay = day;

          content +=
            '<section data-timestamp="' + day + '">' +
            '  <h2>' + headerDate(day) + '</h2>' +
            '  <ol id="' + day + '" class="log-group">';
        }
        content += self.createRecentEntry(recents[i]);
      }
      self.recentsContainer.innerHTML = content;

      self.updateContactDetails();

      var event = new Object();
      self._allViewGroupingPending = true;
      self._missedViewGroupingPending = true;
      if (self.missedFilter.classList.contains('selected')) {
        self.missedFilter.classList.remove('selected');
        event.target = self.missedFilter;
        self.filter(event);
        self.missedFilter.classList.add('selected');
        self.allFilter.classList.remove('selected');
      } else {
        self.allFilter.classList.remove('selected');
        event.target = self.allFilter;
        self.filter(event);
        self.missedFilter.classList.remove('selected');
        self.allFilter.classList.add('selected');
      }

    });
  },

  updateContactDetails: function re_updateContactDetails() {
    var itemSelector = '.log-item',
      callLogItems = document.querySelectorAll(itemSelector),
      length = callLogItems.length,
      phoneNumber;
    for (var i = 0; i < length; i++) {
      phoneNumber = callLogItems[i].dataset.num.trim();
      var cachedContact = this._cachedContacts[phoneNumber];
      if (cachedContact) {
        this.contactCallBack(callLogItems[i], cachedContact);
      } else {
        Contacts.findByNumber(
          phoneNumber,
          this.contactCallBack.bind(this, callLogItems[i]));
      }
    }
  },

  contactCallBack: function re_contactCallBack(logItem, contact) {
    var contactPhoto = logItem.querySelector('.call-log-contact-photo');
    if (contact) {
      var primaryInfo = logItem.querySelector('.primary-info'),
        count = logItem.dataset.count;
      primaryInfo.textContent = ((contact.name && contact.name != '') ?
        contact.name : _('unknown')) + ((count > 1) ? ' (' + count + ')' : '');
      if (contact.photo) {
        contactPhoto.classList.add('knownContact');
        contactPhoto.style.backgroundImage = 'url(' + contact.photo + ')';
      }
      var phoneNumber = logItem.dataset.num.trim(),
        phoneType, phoneCarrier,
        secondaryInfo = logItem.querySelector('.secondary-info'),
        contactPhoneEntry, contactPhoneNumber, contactPhoneType,
        multipleNumbersSameCarrier,
        length = contact.tel.length;
      for (var i = 0; i < length; i++) {
        contactPhoneEntry = contact.tel[i];
        contactPhoneNumber = contactPhoneEntry.value.replace(' ', '', 'g');
        contactPhoneType = contactPhoneEntry.type;
        contactPhoneCarrier = contactPhoneEntry.carrier;
        if (phoneNumber == contactPhoneNumber) {
          if (contactPhoneType) {
            secondaryInfo.textContent = secondaryInfo.textContent.trim() +
              '   ' + contactPhoneType;
            logItem.dataset.phoneType = contactPhoneType;
            phoneType = contactPhoneType;
          }
          if (!contactPhoneCarrier) {
            secondaryInfo.textContent = secondaryInfo.textContent +
              ', ' + phoneNumber;
          } else {
            logItem.dataset.carrier = contactPhoneCarrier;
            phoneCarrier = contactPhoneCarrier;
          }
        }
      }
      if (phoneType && phoneCarrier) {
        var multipleNumbersSameCarrier = false;
        for (var j = 0; j < length; j++) {
          contactPhoneEntry = contact.tel[j];
          contactPhoneNumber = contactPhoneEntry.value.replace(' ', '', 'g');
          contactPhoneType = contactPhoneEntry.type;
          contactPhoneCarrier = contactPhoneEntry.carrier;
          if ((phoneNumber != contactPhoneNumber) &&
            (phoneType == contactPhoneType) &&
            (phoneCarrier == contacePhoneCarrier)) {
            multipleNumbersSameCarrier = true;
          }
        }
        if (multipleNumbersSameCarrier) {
          secondaryInfo.textContent = secondaryInfo.textContent +
            ', ' + phoneNumber;
        } else {
          secondaryInfo.textContent = secondaryInfo.textContent +
            ', ' + contactPhoneCarrier;
        }
      }
      this._cachedContacts[phoneNumber] = contact;
    } else {
      contactPhoto.classList.add('unknownContact');
    }
  },

  groupCallsInCallLog: function re_groupCallsInCallLog() {
    // The grouping of the calls is per day, per contact, per contact
    //  phone number type (Home, Work, Mobile, etc.) and per type of call
    //  (outgoing, incoming, missed).
    var daySelector = '.log-group',
      daysElements = document.querySelectorAll(daySelector),
      daysElementsLength = daysElements.length,
      itemSelector = '.log-item:not(.hide)',
      callLogItems, length, phoneNumber, phoneNumberType, callType,
      callCount, callDate, sameTypeCall,
      sameTypeCallAux, sameTypeCallCount;
    for (var dayElementsCounter = 0; dayElementsCounter < daysElementsLength;
      dayElementsCounter++) {
      callLogItems = daysElements[dayElementsCounter].
        querySelectorAll(itemSelector);
      length = callLogItems.length;
      for (var i = 0; i < length; i++) {
        phoneNumber = callLogItems[i].dataset.num.trim();
        phoneNumberType = callLogItems[i].dataset.phoneType;
        callType = callLogItems[i].dataset.type;
        callCount = (callLogItems[i].dataset.count ?
          parseInt(callLogItems[i].dataset.count) : 1);
        callDate = callLogItems[i].dataset.date;
        if (callType.indexOf('dialing') != -1) {
          sameTypeCall = this.getMostRecentCallWithSameTypeOnSameDay(
            daysElements[dayElementsCounter], phoneNumber, phoneNumberType,
            'dialing', true, 'grouping');
        } else if (callType.indexOf('incoming-connected') != -1) {
          sameTypeCall = this.getMostRecentCallWithSameTypeOnSameDay(
            daysElements[dayElementsCounter], phoneNumber, phoneNumberType,
            'incoming-connected', false, 'grouping');
        } else {
          sameTypeCall = this.getMostRecentCallWithSameTypeOnSameDay(
            daysElements[dayElementsCounter], phoneNumber, phoneNumberType,
            'incoming', false, 'grouping');
          sameTypeCallAux = this.getMostRecentCallWithSameTypeOnSameDay(
            daysElements[dayElementsCounter], phoneNumber, phoneNumberType,
            'incoming-refused', false, 'grouping');
          if (sameTypeCallAux) {
            if (sameTypeCall) {
              if (sameTypeCall.dataset.date < sameTypeCallAux.dataset.date) {
                sameTypeCall = sameTypeCallAux;
              }
            } else {
              sameTypeCall = sameTypeCallAux;
            }
          }
        }

        callLogItems[i].dataset.count = callCount;
        if (sameTypeCall && (sameTypeCall != callLogItems[i])) {
          sameTypeCallCount = parseInt(sameTypeCall.dataset.count);
          if (sameTypeCall.dataset.date > callDate) {
            this.groupCalls(callLogItems[i], sameTypeCall,
              sameTypeCallCount, 1);
          } else {
            this.groupCalls(sameTypeCall, callLogItems[i],
              callCount, sameTypeCallCount);
          }
        }
      }
    }
  },

  groupCalls: function re_groupCalls(olderCallEl, newerCallEl, count, inc) {
    olderCallEl.classList.add('hide');
    olderCallEl.classList.add('collapsed');
    var primaryInfo = newerCallEl.querySelector('.primary-info'),
      callDetails = primaryInfo.textContent.trim(),
      countIndex = callDetails.indexOf('(' + count + ')');
    count += inc;
    if (countIndex != -1) {
      primaryInfo.textContent = callDetails.substr(0, countIndex) +
        '(' + count + ')';
    } else {
      primaryInfo.textContent = callDetails + ' (' + count + ')';
    }
    newerCallEl.dataset.count = count;
  },

  getDayDate: function re_getDayDate(timestamp) {
    var date = new Date(timestamp),
      startDate = new Date(date.getFullYear(),
                             date.getMonth(), date.getDate());
    return startDate.getTime();
  },

  history: function re_history(callback) {
    this.getDatabase((function(database) {
      var recents = [],
        txn = database.transaction(this.STORENAME, 'readonly'),
        store = txn.objectStore(this.STORENAME);

      var cursor = store.openCursor(null, 'prev');
      cursor.onsuccess = function(event) {
        var item = event.target.result;
        if (item) {
          recents.push(item.value);
          item.continue();
        } else {
          callback(recents);
        }
      };

      cursor.onerror = function(event) {
        callback([]);
      };
    }).bind(this));
  },

  updateLatestVisit: function re_updateLatestVisit() {
    localStorage.setItem('latestCallLogVisit', Date.now());
  },

  updateHighlighted: function re_updateHighlighted() {
    var itemSelector = '.log-item.highlighted',
      items = document.querySelectorAll(itemSelector),
      itemsLength = items.length;
    for (var i = 0; i < itemsLength; i++) {
      items[i].classList.remove('highlighted');
    }
  }
};

window.addEventListener('load', function recentsSetup(evt) {
  window.removeEventListener('load', recentsSetup);
  Recents.init();
});

window.addEventListener('unload', function recentsCleanup(evt) {
  window.removeEventListener('unload', recentsCleanup);
  Recents.cleanup();
});
