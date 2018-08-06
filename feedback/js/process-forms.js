'use strict';
var feedbackForm = (function () {
  // переключить во включенное или выключенное состояние кнопку submit
  var _changeStateSubmit = function (element, state) {
    $(element)
      .closest('form')
      .find('[type="submit"]')
      .prop('disabled', state);
  };
  // изменение состояния кнопки submit в зависимости от состояния checkbox agree
  var _changeAgreement = function () {
    var _this = this;
    _changeStateSubmit(_this, !_this.checked);
  };
  // обновление капчи
  var _refreshCaptcha = function (form) {
    var
      captchaImg = form.find('.img-captcha'),
      captchaSrc = captchaImg.attr('data-src'),
      captchaPrefix = captchaSrc.indexOf('?id') !== -1 ? '&rnd=' : '?rnd=',
      captchaNewSrc = captchaSrc + captchaPrefix + (new Date()).getTime();
    captchaImg.attr('src', captchaNewSrc);
  };
  // изменение состояния элемента формы (success, error, clear)
  var _setStateValidaion = function (input, state, message) {
    input = $(input);
    if (state === 'error') {
      input
        .removeClass('is-valid')
        .addClass('is-invalid')
        .siblings('.invalid-feedback')
        .text(message);
    } else if (state === 'success') {
      input.removeClass('is-invalid').addClass('is-valid');
    } else {
      input.removeClass('is-valid is-invalid');
    }
  };
  // валилация формы
  var _validateForm = function (_$form) {
    var valid = true;
    _$form.find('input,textarea').not('[type="file"],[name="agree"]').each(function () {
      if (this.checkValidity()) {
        _setStateValidaion(this, 'success');
      } else {
        _setStateValidaion(this, 'error', this.validationMessage);
        valid = false;
      }
    });
    return valid;
  };
  var _addInputFile = function (element, maxFiles, codeAttachment) {
    var
      isNotEmpty = element.files.length > 0,
      isLast = $(element).closest('.custom-file').next('.custom-file').length === 0,
      isMaxFiles = $(element).closest('.attachments').find('input[name="attachment[]"]').length < maxFiles;
    if (isNotEmpty && isLast && isMaxFiles) {
      $(element).closest('.custom-file').after(codeAttachment);
    }
  };
  // метод, возвращающий результат проверки расширения файла допустимому
  var _validateFileExt = function (filename, validExtFiles) {
    // получаем расширение файла
    var
      extFile = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2),
      validExtLength = validExtFiles.length,
      i;
    // если есть расширение, то проверяем соотвествует ли оно допустимому
    if (extFile) {
      for (i = 0; i <= validExtLength; i++) {
        if (validExtFiles[i] === extFile.toLowerCase()) {
          return true;
        }
      }
    }
    return false;
  };
  var _validateInputFile = function (element, maxFileSize, validExtFiles) {
    // валидация файла
    if (element.files.length > 0) {
      // получим файл
      var
        file = element.files[0],
        element = $(element);
      element
        .next('.custom-file-label')
        .addClass("selected")
        .text(file.name);
      // проверим размер и расширение файла
      if (file.size > maxFileSize) {
        element
          .removeClass('is-valid')
          .addClass('is-invalid')
          .closest('.custom-file')
          .find('.invalid-feedback')
          .text('Файл не будет отправлен, т.к. его размер больше ' + maxFileSize / 1024 + 'Кбайт');
      } else if (!_validateFileExt(file.name, validExtFiles)) {
        element
          .removeClass('is-valid')
          .addClass('is-invalid')
          .closest('.custom-file')
          .find('.invalid-feedback')
          .text('Файл не будет отправлен, т.к. его тип не соответствует разрешённому.');
      } else {
        element
          .removeClass('is-invalid')
          .addClass('is-valid');
      }
    } else {
      // если после изменения файл не выбран, то сообщаем об этом пользователю
      element
        .next('.custom-file-label')
        .addClass("selected")
        .text('')
        .end()
        .removeClass('is-valid')
        .addClass('is-invalid')
        .closest('.custom-file')
        .find('.invalid-feedback')
        .text('Файл не будет отправлен, т.к. он не выбран');
    }
  }
  // disabled и enabled изображений для FormData
  var _changeStateAttachments = function (form, state, validExtFiles, maxFileSize) {
    var
      files = form.find('[name="attachment[]"]'),
      filesLength = files.length;
    for (var i = 0; i < filesLength; i++) {
      // получить список файлов элемента input с type="file"
      var fileList = files[i].files;
      // если элемент не содержит файлов, то перейти к следующему
      if (fileList.length > 0) {
        // получить первый файл из списка
        var file = fileList[0];
        // проверить тип файла и размер
        if (!((_validateFileExt(file.name, validExtFiles)) && (file.size < maxFileSize))) {
          $(files[i]).prop('disabled', state);
        }
      } else {
        $(files[i]).prop('disabled', state);
      }
    }
  };
  var _showForm = function (form) {
    form.siblings('.form-success').addClass('d-none');
    form.find('.form-error').addClass('d-none');
    form.show();
  };

  return function () {
    var _defaults = {
      id: '#feedbackForm', // id формы обратной связи   id_form
      isHideForm: true, // скрыть форму после отправки         hideForm
      maxFiles: 5, // количество элементов input  countFiles
      maxFileSize: 524288, // maxSizeFile
      validExtFiles: ['jpg', 'jpeg', 'gif', 'png'] // допустимые разрешения файлов validFileExtensions
    }
    var
      _form = $(_defaults.id)[0], // форма обратной связи
      _$form = $(_form),
      _action = $(_form).attr('action'),
      _codeAttachment = '',
      _codeAttachments = '',
      _isUploadsFiles = false, // имеется ли у формы блок загрузки файлов existenceUploadsFile
      _isCaptcha = false,  //наличие у формы капчи  existenceCaptcha
      _isAgreeCheckbox = false; // флажок о принятии пользовательского соглашения перед отправкой формы  agreeCheckbox
    // сбор данных для отправки на сервер с помощью FormData
    var _collectData = function () {
      _changeStateAttachments(_$form, true, _defaults.validExtFiles, _defaults.maxFileSize); // отключаем отправку файлов (disabled) не удовлетворяющие требованиям
      var data = new FormData(_form); // собираем данные
      _changeStateAttachments(_$form, false, _defaults.validExtFiles, _defaults.maxFileSize); // после сбора данных переводим состояние элементов в enabled
      return data;
    };
    // отправка формы
    var _sendForm = function (e) {
      e.preventDefault();
      if (!_validateForm(_$form)) {
        if (_$form.find('.is-invalid').length > 0) {
          _$form.find('.is-invalid')[0].focus();
        }
        return;
      }
      var request = $.ajax({
        type: "POST",
        url: _action,
        data: _collectData(), // данные для отправки на сервер
        contentType: false,
        processData: false,
        cache: false,
        beforeSend: function () {
          _$form.find('.progress').removeClass('d-none');
          _changeStateSubmit(_$form, true);
        },
        xhr: function () {
          var myXhr = $.ajaxSettings.xhr();
          if (myXhr.upload) {
            myXhr.upload.addEventListener('progress', function (event) {
              // если известно количество байт для пересылки
              if (event.lengthComputable) {
                var total = event.total; // общее количество байт для отправки
                var loaded = event.loaded; // сколько уже отправлено
                var progress = ((loaded * 100) / total).toFixed(1); // процент отправленных данных
                // обновляем состояние прогресс бара
                _$form.find('.progress-bar')
                  .attr('aria-valuenow', progress)
                  .width(progress + '%')
                  .find('span')
                  .text(progress + '%');
              }
            }, false);
          }
          return myXhr;
        }
      })
        .done(_success)
        .fail(_error)
        .always(_complete);
    };
    var _success = function (data) {
      // если сервер вернул ответ success, то значит двнные отправлены
      if (data.result === "success") {
        _$form
          .find('.progress').addClass('d-none');
        _$form[0].reset();
        _$form.find('input,textarea').each(function () {
          _setStateValidaion(this, 'clear');
        });
        if (_isUploadsFiles) {
          _$form.find('.attachments').html(_codeAttachments);
        }
        if (_isCaptcha) {
          _refreshCaptcha(_$form);
        }
        if (_isAgreeCheckbox) {
          _changeStateSubmit(_$form, true);
        } else {
          _changeStateSubmit(_$form, false);
        }
        if (!_$form.find('.form-error').hasClass('d-none')) {
          _$form.find('.form-error').addClass('d-none');
        }
        _$form.parent().find('.form-success').removeClass('d-none');
        if (_defaults.isHideForm) {
          _$form.hide();
        } else {
          _$form.find('.submit').hide();
          window.setTimeout(function () {
            _$form.find('.submit').show();
            _$form.parent().find('.form-success').addClass('d-none');
          }, 5000);
        }
        return;
      }
      _$form
        .find('.progress')
        .addClass('d-none')
        .find('.progress-bar')
        .css('width', '0%')
        .end()
        .end()
        .find('.form-error')
        .removeClass('d-none');
      _changeStateSubmit(_$form, false);
      // сбрасываем состояние всех input и textarea элементов
      _$form.find('input,textarea').not('[type="file"]').each(function () {
        _setStateValidaion(this, 'clear');
      });
      // отображаем ошибки
      var customFileLabes = _$form.find('.custom-file-label');
      for (var error in data) {
        if (!data.hasOwnProperty(error)) {
          continue;
        };
        switch (error) {
          case 'captcha':
            _refreshCaptcha(_$form);
            _setStateValidaion(_$form.find('[name="' + error + '"]'), 'error', data[error]);
            break;
          case 'attachment':
            customFileLabes.each(function () {
              $.each(data[error], function (key, value) {
                var _this = this;
                if ($(_this).text() === key) {
                  $(_this).siblings('[name]').attr('data-key', key);
                  _setStateValidaion($(_this).siblings('[name]')[0], 'error', value);
                }
              });
            });
            break;
          case 'log':
            $.each(data[error], function (key, value) {
              console.log(value);
            });
            break;
          default:
            _setStateValidaion(_$form.find('[name="' + error + '"]'), 'error', data[error]);
        }
        if (_$form.find('.is-invalid').length > 0) {
          _$form.find('.is-invalid')[0].focus();
        }
      }
    };
    var _error = function (request) {
      _$form
        .find('.progress-bar').css('width', '0%').end()
        .find('.form-error').removeClass('d-none');
    };

    var _complete = function () {

    };

    var _changeInputFile = function (e) {
      _addInputFile(e.currentTarget, _defaults.maxFiles, _codeAttachment);
      _validateInputFile(e.currentTarget, _defaults.maxFileSize, _defaults.validExtFiles);
    };

    var _setupListener = function () {
      $(document).on('change', _defaults.id + ' [name="agree"]', _changeAgreement);
      $(document).on('submit', _defaults.id, _sendForm);
      $(document).on('click', _defaults.id + ' .refresh-captcha', function () {
        _refreshCaptcha(_$form);
      });
      $(document).on('change', _defaults.id + ' [name="attachment[]"]', _changeInputFile);
      $(document).on('click', '[data-form="' + _defaults.id + '"]', function (e) {
        e.preventDefault();
        _showForm(_$form);
      });
    }

    return {
      init: function (config) {
        var
          attachments = _$form.find('.attachments');
        _isUploadsFiles = attachments.length > 0; // имеется ли у формы секция attachments
        _isCaptcha = _$form.find('.captcha').length > 0; // имеется ли у формы секция captcha
        _isAgreeCheckbox = _$form.find('.agreement').length > 0; // имеется ли у формы секция agreement
        if (_isUploadsFiles) {
          _codeAttachment = attachments.find('.custom-file')[0].outerHTML;
          _codeAttachments = attachments.html();
          if (attachments.attr('data-maxfiles') !== undefined) {
            _defaults.maxFiles = attachments.attr('data-maxfiles');
          }
          if (attachments.attr('data-maxsize') !== undefined) {
            _defaults.maxFileSize = attachments.attr('data-maxsize');
          }
          if (attachments.attr('data-validext') !== undefined) {
            var arrayExtFiles = attachments.attr('data-validext').split(',');
            $.each(arrayExtFiles, function (index, value) {
              arrayExtFiles[index] = $.trim(value);
            })
            _defaults.validExtFiles = arrayExtFiles;
          }
        }

        $.each(config, function (key, value) {
          _defaults[key] = value;
        });
        _setupListener();
      }
    };
  }
})();