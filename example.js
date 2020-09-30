/**
 * @method setUploadProgress
 * @param {number} percentage
 */
function setUploadProgress(percentage) {
        $('#upload-progress-bar').css('width', percentage + '%').attr('aria-valuenow', percentage);
    }

/**
 * @method cleanupStep
 * @param {number} stepNum
 */
function cleanupStep(stepNum) {
        switch (stepNum) {
            case 2:
                this.unloadPromptStep();
                break;
        }
    }


/**
 * Collects serialized data about a task
 * @method serializeTask
 * @returns {object} object
 */
function serializeTask() {
    let taskData = wizard.$taskEditor.children("input, textarea, select").serializeArray();

    let task = {};
    taskData.forEach(kv => task[kv.name] = kv.value);
    task['dataset'] = wizard.presets.id;

    // Merges the cached data with the serialized form.
    // All subtasks are in the cached data!
    return Object.assign({}, wizard.currentTask, task);
}

/**
 * @method writeFile
 * @param {string} filename
 * @param {object} options
 * @returns {function} writes to file
 */
function writeFile(filename, options) {
    options = options || {};

    const streamOptions = {
      encoding: options.encoding || 'utf8',
    };
    const stream = fs.createWriteStream(filename, streamOptions);

    return this.write(stream, options);
  }

/**
 * The function logs error or information to the error div.
 * @method screenLogger
 * @param {string} text the text that should be logged.
 */
function screenLogger(text) {
    $('#divError').text(text);
}

/**
 * @method WorkflowBtns
 * @param {string} exitUrl
 */
function WorkflowBtns(exitUrl) {
    // Dom of submit and load next btn
    this.nextBtn = null;
    // Dom of exit task btn
    this.exitBtn = null;
    // The url the user will be directed to when they exit
    this.exitUrl = exitUrl;

    // Boolean that determined if the exit button is shown
    this.showExitBtn = false;
}

/**
 * @method updateRender
 * @param {number} pxPerSec
 */
function updateRender(pxPerSec) {
         // duration varies during loading process, so don't overwrite important data
        const dur = this.wavesurfer.getDuration();
        const width = this.getWidth();

        var startLimited = this.start;
        var endLimited = this.end;
        if (startLimited < 0) {
            startLimited = 0;
            endLimited = endLimited - startLimited;
        }
        if (endLimited > dur) {
            endLimited = dur;
            startLimited = dur - (endLimited - startLimited);
        }

        if (this.minLength != null) {
            endLimited = Math.max(startLimited + this.minLength, endLimited);
        }

        if (this.maxLength != null) {
            endLimited = Math.min(startLimited + this.maxLength, endLimited);
        }

        if (this.element != null) {
            // Calculate the left and width values of the region such that
            // no gaps appear between regions.
            const left = Math.round((startLimited / dur) * width);
            const regionWidth = Math.round((endLimited / dur) * width) - left;

            this.style(this.element, {
                left: left + 'px',
                width: regionWidth + 'px',
                // backgroundColor: this.color,
                cursor: this.drag ? 'pointer' : 'default'
            });

            for (const attrname in this.attributes) {
                this.element.setAttribute(
                    'data-region-' + attrname,
                    this.attributes[attrname]
                );
            }

            this.element.title = this.formatTime(this.start, this.end);
        }
        this.wavesurfer.fireEvent('region-updated', this);

    }

/**
 * @method typeReadable
 * @param {string} type
 * @returns readable type
 */
function typeReadable(type) {
    return type === 'promptgroup' ? 'prompt group' : type;
}

/**
 * @method pluralize
 * @param {string} noun
 * @param {number} count
 * @returns Noun pluralized
 */
function pluralize(noun, count) {
    return noun + (count === 1 ? '' : 's');
}

/**
     * Constructs a PaginatedTable which in itself contains a Table and Paginator component.
     *
     * Needs the following HTML skeleton:
     * - Root container, normally div, containing:
     *     - A table, see table.js
     *     - A paginator, see paginator.js
     *
     * @param {string} selector A CSS or jQuery selector pointing to the PaginatedTable's root element
     * @param {string} apiUrl The URL from which to fetch data. Witout trailing '/', without query parameters.
     * @param {function} insertFunc Like Table#fetchFunc but data is fed in as a parameter
     * instead of the function needing to fetch it. The offset can be added to the index of each row so that later
     * pages don't have indices starting with 1.
     * @param {function} equalFunc See Table#areEqual
     * @param {boolean} showStartEnd
     * @param {boolean} showPrevNext
     * @param {number} maxElements
     * @param {boolean} enableCache Enable caching of already requested pages. Does not cache query results.
     * @param {function} navigationCallback Gets called when a new page is requested by the user, before it is loaded.
     */
function constructor(selector, apiUrl, insertFunc, equalFunc, enableCache = true, showStartEnd = true, showPrevNext = true, maxElements = 5, navigationCallback = PaginatedTable.NO_CALLBACK) {
        this.$root = $(selector);
        this.$table = this.$root.find('.pt-table');
        this.$paginator = this.$root.find('.pt-paginator');

        this._baseUrl = apiUrl;
        if (this._baseUrl.endsWith("/")) this._baseUrl = this._baseUrl.slice(0, -1);

        this.filters = new Map();
        this._pageCount = -1; // Dummy value to indicate that no pages exist yet
        this._insertFunc = insertFunc;
        this._pageSize = 0;
        this._locked = false;
        this._cacheEnabled = enableCache;

        const thisTable = this;

        const pgHandler = () => {
            if (!thisTable._locked) {
                thisTable._locked = true;
                navigationCallback();
                thisTable.table.invokeUpdate()
            }
        };

        const cachingFetchFunc = table => {
            thisTable._locked = true;

            if (thisTable._cacheEnabled && thisTable._cache === undefined) thisTable._cache = new Map();

            // If page is in cache, use it. Don't cache filtered pages
            if (thisTable._cacheEnabled && thisTable.filters.size === 0 && thisTable._cache.has(thisTable._getCurrentPage())) {
                thisTable._insertFunc(thisTable.table,
                    thisTable._cache.get(thisTable._getCurrentPage()),
                    (thisTable._getCurrentPage() - 1) * thisTable._pageSize);

                thisTable._locked = false;
                return {done: func => func()} // Empty promise
            }
            // Else, request is as per usual
            else {
                return $.get(thisTable._assembleUrl(), data => {
                    // On first request, we don't know how many pages exist. Therefore we cannot init the paginator
                    // and thus need to do it once the request is finished - which is the case here:
                    if (thisTable._pageCount === -1) {
                        thisTable._pageCount = data.pageCount;
                        thisTable._pageSize = data.pageSize;

                        let pages = [];
                        for (let i = 1; i <= thisTable._pageCount; i++) pages.push({address: i, handler: pgHandler});

                        thisTable.paginator.setPages(pages, 1, false);
                    }

                    // Do not cache filtered pages as they are subject to frequent change
                    if (thisTable._cacheEnabled && thisTable.filters.size === 0)
                        thisTable._cache.set(thisTable._getCurrentPage(), data.results);

                    thisTable._insertFunc(table, data.results, (thisTable._getCurrentPage() - 1) * thisTable._pageSize);
                    thisTable._locked = false;
                })
            }
        };

        this.table = new Table(this.$table, cachingFetchFunc, equalFunc);
        this.paginator = new Paginator(this.$paginator, [], 1, showStartEnd, showPrevNext, maxElements, false);
    }

/**
 * Makes a query and shows the results in the table.
 *
 * @param {map} filters A map of param-name --> param_value to be used as query parameters.
 * @returns {boolean} false, if another query is currently in progress, else true
 */
function makeQuery(filters) {
    if (this._locked) return false;

    this._locked = true;
    this.filters = filters;
    this._pageCount = -1;
    this.table.invokeUpdate();
    return true;
}



/**
 *
 * @returns {string} url Url of the image
 */
function getImageSource() {
  return this.$t("images." + this.currentPrompt.class)
}

/**
 * @param {string} previousUrl Url of the image
 */
function update(previousUrl) {
        var my = this;
        var mainUpdate = function(annotationSolutions, previousUrl) {

            // Update the different tags the user can use to annotate, also update the solutions to the
            // annotation task if the user is suppose to recieve feedback
            var proximityTags = my.currentTask.proximityTag;
            var userTags = my.currentTask.userTag;
            var predefinedTags = my.currentTask.predefinedTags;
            var tutorialVideoURL = my.currentTask.tutorialVideoURL;
            var alwaysShowTags = my.currentTask.alwaysShowTags;
            var instructions = my.currentTask.instructions;

            var reloadSameUrl = previousUrl === my.currentTask.url;
            my.stages.reset(
                proximityTags,
                userTags,
                predefinedTags,
                annotationSolutions,
                alwaysShowTags, reloadSameUrl
            );

            // set video url
            $('#tutorial-video').attr('src', tutorialVideoURL);


            // // add instructions
            // var instructionsContainer = $('#instructions-container');
            // instructionsContainer.empty();
            // if (typeof instructions !== "undefined"){
            //     $('.modal-trigger').leanModal();
            //     instructions.forEach(function (instruction, index) {
            //         if (index==0) {
            //             // first instruction is the header
            //             var instr = $('<h4>', {
            //                 html: instruction
            //             });
            //         } else {
            //             var instr = $('<h6>', {
            //                 "class": "instruction",
            //                 html: instruction
            //             });
            //         }
            //         instructionsContainer.append(instr);
            //     });
            //     if (!my.instructionsViewed) {
            //         $('#instructions-modal').openModal();
            //         my.instructionsViewed = true;
            //     }
            // }
            // else
            // {
            //     $('#instructions-container').hide();
            //     $('#trigger').hide();
            // }

            // Update the visualization type and the feedback type and load in the new audio clip
            my.wavesurfer.params.visualization = my.currentTask.visualization; // invisible, spectrogram, waveform
            my.wavesurfer.params.feedback = my.currentTask.feedback; // hiddenImage, silent, notify, none
            my.wavesurfer.params.minPxPerSec = 20;
            my.wavesurfer.load(my.currentTask.url);
        };

        if (this.currentTask.feedback !== 'none') {
            // If the current task gives the user feedback, load the tasks solutions and then update
            // interface components
            $.getJSON(this.currentTask.annotationSolutionsUrl)
            .done(function(data) {
                mainUpdate(data);
            })
            .fail(function() {
                alert('Error: Unable to retrieve annotation solution set');
            });
        } else {
            // If not, there is no need to make an additional request. Just update task specific data right away
            mainUpdate({}, previousUrl);
        }

    }

/**
 * @param {string} password
 */
function setPassword(password) {
    try {
      this.password = password;
      this._hasPassword = true;
      this.keychain.setPassword(password, this.url);
      const result = setPassword(this.id, this.ownerToken, this.keychain);
      return result;
    } catch (e) {
      this.password = null;
      this._hasPassword = false;
      throw e;
    }
  }


/**
 * @returns {object} Object with all information
 */
function toJSON() {
return {
  id: this.id,
  url: this.url,
  name: this.name,
  size: this.size,
  manifest: this.manifest,
  time: this.time,
  speed: this.speed,
  createdAt: this.createdAt,
  expiresAt: this.expiresAt,
  secretKey: arrayToB64(this.keychain.rawSecret),
  ownerToken: this.ownerToken,
  dlimit: this.dlimit,
  dtotal: this.dtotal,
  hasPassword: this.hasPassword,
  timeLimit: this.timeLimit
};
}

/**
 * @param {number} imgNo
 * @param {number} questionId
 */
 function reset_image(imgNo, questionId) {
            var img = document.getElementById("manikin" + imgNo + "_" + questionId)
            var manikin = document.getElementById("manikin" + imgNo + "_" + questionId);
            if (SAM_SCALE[questionId] == 5) {
                switch (imgNo) {
                    case 0:
                        src = manikin0;
                        break;
                    case 1:
                        src = manikin2;
                        break;
                    case 2:
                        src = manikin4;
                        break;
                    case 3:
                        src = manikin6;
                        break;
                    case 4:
                        src = manikin8;
                        break;
                    default:
                        break;
                }
            } else if (SAM_SCALE[questionId] == 7) {
                switch (imgNo) {
                    case 0:
                        src = manikin0;
                        break;
                    case 1:
                        src = manikin1;
                        break;
                    case 2:
                        src = manikin3;
                        break;
                    case 3:
                        src = manikin4;
                        break;
                    case 4:
                        src = manikin5;
                        break;
                    case 5:
                        src = manikin7;
                        break;
                    case 6:
                        src = manikin8;
                        break;
                    default:
                        break;
                }
            } else if (SAM_SCALE[questionId] == 9) {
                switch (imgNo) {
                    case 0:
                        src = manikin0;
                        break;
                    case 1:
                        src = manikin1;
                        break;
                    case 2:
                        src = manikin2;
                        break;
                    case 3:
                        src = manikin3;
                        break;
                    case 4:
                        src = manikin4;
                        break;
                    case 5:
                        src = manikin5;
                        break;
                    case 6:
                        src = manikin6;
                        break;
                    case 7:
                        src = manikin7;
                        break;
                    case 8:
                        src = manikin8;
                        break;
                    default:
                        break;
                }
            }
            manikin.setAttribute("src", src);
            manikin.classList.remove("manikin-selected");

        }

/**
 * @param {object} contextDict
 */
function update_progress(contextDict) {

            if (!lastInLevel && !contextDict.data_available) {
                $('#dataNotAvailableModal').modal('show');
                modalShown = true;

                $('returnToNextTaskButton').on('click', function () {
                    window.location.replace(contextDict.next_task_link);
                    modalShown = false;
                });
            }

            $(".databaseProgressText").text(contextDict.database.block_level); //e.g. Level 2 of 10
            $(".databaseProgressTextMax").text(contextDict.database.block_max_level);
            var databaseProgressBar = $("#databaseProgressBar");
            databaseProgressBar.text(contextDict.database.progress + "%"); //e.g. 20%
            databaseProgressBar.attr("aria-valuenow", contextDict.database.progress);
            databaseProgressBar.css("width", contextDict.database.progress + "%");

            $("#blockProgressText").text(contextDict.database.block_answered_count); //e.g. {3} of 15 annotations compl.
            $("#blockSize").text(contextDict.database.block_question_count); //e.g. 3 of {15} annotations compl.
            var blockProgressBar = $("#blockProgressBar");
            blockProgressBar.text(contextDict.database.block_progress + "%");
            blockProgressBar.attr("aria-valuenow", contextDict.database.block_progress);
            blockProgressBar.css("width", contextDict.database.block_progress + "%");
        }



/**
   * @function waitForPageToLoad
   * @returns {Object} An object representing the page.
   */
 function waitForPageToLoad() {
    browser.waitUntil(function() {
      return browser.execute(function() {
        return typeof window.app !== 'undefined';
      });
    }, 3000);
    browser.pause(100);
    return this;
  }

/**
 * @returns {boolean} isLastInPromptgroup
 */
function isLastInPromptGroup() {
    var isLastInPromptgroup = true;
    var prog = $('#progressbar-text').text().slice(0,-1);
    if (prog === "100") {
        isLastInPromptgroup = false;
    } else {
        $('#jstree li').each(function (index, value) {
            var node = $("#jstree").jstree().get_node(this.id);
            var type = node.type;
            if (type == "default") {
                isLastInPromptgroup = false;
                return false; // break out of each loop
            }
        });
    }
    return isLastInPromptgroup;
}

/**
 * @param {Array} msgArray
 */
function writeMessages(msgArray) {
    var messageList = $.map(msgArray, function (msg, i) {
            var listItem = $('<div></div>').addClass('alert alert-dismissable alert-' + msg.level);
            $('<button type="button" class="close" data-dismiss="alert" aria-hidden="true">×</button>').appendTo(listItem);
            $('<span>' + msg.body + '</span>').appendTo(listItem);
            return listItem;
        });
        $('#dynamic-messages').append('<p></p>').html(messageList);
}


/**
 * Creates one button for each of the current task's subtasks.
 * Asserts that the subtasks nav is identical to its template, i.e. it has been freshly reset.
 * @param {number} activeIndex
 */
function _loadSubtaskNavBtns(activeIndex = 0) {
    wizard.currentTask.subtasks.forEach((subtask, i) => DatasetEditWizard._addSubtaskNavBtn(i, false));
    DatasetEditWizard.switchSubtask(activeIndex, false);
}


/**
 * @param {number} t
 */
function bounceInOut(t) {
    return t < 0.5
        ? 0.5 * (1.0 - bounceOut(1.0 - t * 2.0))
        : 0.5 * bounceOut(t * 2.0 - 1.0) + 0.5;
}


// RecordRTC.promises.js

/**
 * RecordRTCPromisesHandler adds promises support in {@link RecordRTC}. Try a {@link https://github.com/muaz-khan/RecordRTC/blob/master/simple-demos/RecordRTCPromisesHandler.html|demo here}
 * @summary Promises for {@link RecordRTC}
 * @license {@link https://github.com/muaz-khan/RecordRTC/blob/master/LICENSE|MIT}
 * @author {@link https://MuazKhan.com|Muaz Khan}
 * @typedef RecordRTCPromisesHandler
 * // Note: You can access all RecordRTC API using "recorder.recordRTC" e.g.
 * recorder.recordRTC.onStateChanged = function(state) {};
 * recorder.recordRTC.setRecordingDuration(5000);
 * @see {@link https://github.com/muaz-khan/RecordRTC|RecordRTC Source Code}
 * @param {MediaStream} mediaStream Single media-stream object, array of media-streams, html-canvas-element, etc.
 * @param {object} options config {type:"video", recorderType: MediaStreamRecorder, disableLogs: true, numberOfAudioChannels: 1, bufferSize: 0, sampleRate: 0, video: HTMLVideoElement, etc.}
 */

function RecordRTCPromisesHandler(mediaStream, options) {
    if (!this) {
        throw 'Use "new RecordRTCPromisesHandler()"';
    }

    if (typeof mediaStream === 'undefined') {
        throw 'First argument "MediaStream" is required.';
    }

    var self = this;

    /**
     * @property {Blob} blob - Access/reach the native {@link RecordRTC} object.
     * @memberof RecordRTCPromisesHandler
     * @example
     * let internal = recorder.recordRTC.getInternalRecorder();
     * alert(internal instanceof MediaStreamRecorder);
     * recorder.recordRTC.onStateChanged = function(state) {};
     */
    self.recordRTC = new RecordRTC(mediaStream, options);

    /**
     * This method records MediaStream.
     * @method
     * @memberof RecordRTCPromisesHandler
     * @example
     * recorder.startRecording()
     *         .then(successCB)
     *         .catch(errorCB);
     */
    this.startRecording = function() {
        return new Promise(function(resolve, reject) {
            try {
                self.recordRTC.startRecording();
                resolve();
            } catch (e) {
                reject(e);
            }
        });
    };

    /**
     * This method stops the recording.
     * @method
     * @memberof RecordRTCPromisesHandler
     * @example
     * recorder.stopRecording().then(function() {
     *     var blob = recorder.getBlob();
     * }).catch(errorCB);
     */
    this.stopRecording = function() {
        return new Promise(function(resolve, reject) {
            try {
                self.recordRTC.stopRecording(function(url) {
                    self.blob = self.recordRTC.getBlob();

                    if (!self.blob || !self.blob.size) {
                        reject('Empty blob.', self.blob);
                        return;
                    }

                    resolve(url);
                });
            } catch (e) {
                reject(e);
            }
        });
    };
}


/**
 *
 * We defend against outside modifications by extending the chart data. It
 * may be overkill.
 *
 * @override
 * @returns {Object} object with index
 */
function get() {
        var self = this;
        return _.extend({}, this.chart, {
            comparisonFieldIndex: self._getComparisonFieldIndex(),
        });
    }

 /**
 * Called when a channel has been fetched, and the server responses with the
 * last message fetched. Useful in order to track last message fetched.
 *
 * @param {number} channelID
 * @param {Object} data
 */
    function _handleChannelFetchedNotification(channelID, data) {
        var channel = this.getChannel(channelID);
        if (!channel) {
            return;
        }
        if (channel.hasSeenFeature()) {
            channel.updateSeenPartnersInfo(data);
        }
    }
