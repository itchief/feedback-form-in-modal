"use strict";

//после загрузки веб-страницы
$(function () {

    var ProcessForm = function (parameters) {
        // id формы обратной связи
        this.id_form = parameters['id_form'] || 'feedbackForm';
        // скрыть форму после отправки
        if (parameters['hideForm'] === false) {
            this.hideForm = parameters['hideForm'];
        } else {
            this.hideForm = true;
        }
        // наличие у формы блока загрузки файлов
        if (parameters['existenceUploadsFile'] === false) {
            this.existenceUploadsFile = parameters['existenceUploadsFile'];
        } else {
            this.existenceUploadsFile = true;
        }
        // наличие у формы капчи
        if (parameters['existenceCaptcha'] === false) {
            this.existenceCaptcha = parameters['existenceCaptcha'];
        } else {
            this.existenceCaptcha = true;
        }
        // количество элементов input для загрузки файлов
        this.countFiles = parameters['countFiles'] || 5;
        // максимальный размер файла для загрузки (по умолчанию 512 Кбайт)
        this.maxSizeFile = parameters['maxSizeFile'] || 524288;
        // допустимые разрешения файлов
        this.validFileExtensions = parameters['validFileExtensions'] || ['jpg', 'jpeg', 'bmp', 'gif', 'png'];
        // флажок о принятии пользовательского соглашения перед отправкой формы
        if (parameters['agreeCheckbox'] === false) {
            this.agreeCheckbox = parameters['agreeCheckbox'];
        } else {
            this.agreeCheckbox = true;
        }
        // инициализация
        this.init = function () {
            var submitForm = document.getElementById(this.id_form);
            this.form = $('#' + this.id_form);
            this.attachments_code = this.form.find('.attachments').html();
            this.custom_file = '<div class="custom-file mt-1">' +
                this.form.find('.custom-file').html() + '</div>';
            var form = this.form;
            // отправка формы
            form.submit($.proxy(this.submitForm, this));
            if (this.existenceCaptcha) {
                // обновление капчи
                form.find('.refresh-captcha').click($.proxy(this.refreshCaptcha, this));
            }
            if (this.existenceUploadsFile) { // добавление новых элементов input с type="file" и изменение существующих
                form.find('.countFiles').text(this.countFiles);
                // добавление нового элемента input с type="file"
                $(document).on('change', '#' + this.id_form + ' input[name="attachment[]"]', $.proxy(this.changeInputFile, this));
            }
            if (this.agreeCheckbox) { // добавление новых элементов input с type="file"
                // добавление нового элемента input с type="file"
                $(document).on('change', '#' + this.id_form + ' input[name="agree"]', $.proxy(this.changeAgreement, this));
            }
            if (this.hideForm) {
                form.parent().find('.form-success-link').click(function (e, self) {
                    e.preventDefault();
                    $(this).closest('.form-success').addClass('d-none');
                    form.find('.form-error').addClass('d-none');
                    form.show();
                });
            }
        };
    };

    // переключить во включенное или выключенное состояние кнопку submit
    ProcessForm.prototype.changeStateSubmit = function (state) {
        this.form.find('[type="submit"]').prop('disabled', state);
    };

    // изменение состояния кнопки submit в зависимости от состояния checkbox agree
    ProcessForm.prototype.changeAgreement = function (e) {
        if (e.currentTarget.checked) {
            this.changeStateSubmit(false);
        } else {
            this.changeStateSubmit(true);
        }
    };

    // метод, возвращающий результат проверки расширения файла допустимому
    ProcessForm.prototype.validateFileExtension = function (filename) {
        // получаем расширение файла
        var fileExtension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
        // если есть расширение, то проверяем соотвествует ли оно допустимому
        if (fileExtension) {
            for (var i = 0; i <= this.validFileExtensions.length; i++) {
                if (this.validFileExtensions[i] === fileExtension.toLowerCase()) {
                    return true;
                }
            }
        }
        return false;
    };

    // валилация формы
    ProcessForm.prototype.validateForm = function () {
        var _this = this;
        var validForm = true;
        this.form.find('input,textarea').not('[type="file"]').each(function () {
            if (this.checkValidity()) {
                _this.changeStateInput(this, 'success');
            } else {
                _this.changeStateInput(this, 'error', this.validationMessage);
                validForm = false;
            }
        });
        return validForm;
    };

    // изменение состояния элемента формы (success, error, clear)
    ProcessForm.prototype.changeStateInput = function (input, state, message) {
        input = $(input);
        if (state === 'error') {
            input.removeClass('is-valid').addClass('is-invalid');
            input.parents('.form-group').find('.invalid-feedback').text(message);
        } else if (state === 'success') {
            input.removeClass('is-invalid').addClass('is-valid');
        } else {
            input.removeClass('is-valid is-invalid');
        }
    };

    // disabled и enabled изображений для FormData
    ProcessForm.prototype.changeStateImages = function (state) {
        if (!this.existenceUploadsFile) {
            return;
        }
        var files = this.form.find('[name="attachment[]"]');
        for (var i = 0; i < files.length; i++) {
            // получить список файлов элемента input с type="file"
            var fileList = files[i].files;
            // если элемент не содержит файлов, то перейти к следующему
            if (fileList.length > 0) {
                // получить первый файл из списка
                var file = fileList[0];
                // проверить тип файла и размер
                if (!((this.validateFileExtension(file.name)) && (file.size < this.maxSizeFile))) {
                    $(files[i]).prop('disabled', state);
                }
            } else {
                $(files[i]).prop('disabled', state);
            }
        }
    };

    // сбор данных для отправки на сервер с помощью FormData
    ProcessForm.prototype.collectData = function () {
        this.changeStateImages(true); // отключаем отправку файлов (disabled) не удовлетворяющие требованиям
        this.dataForm = new FormData(document.getElementById(this.id_form)); // собираем данные
        this.changeStateImages(false); // после сбора данных переводим состояние элементов в enabled
    };

    // отправка формы
    ProcessForm.prototype.submitForm = function (e) {
        var _this = this;
        e.preventDefault();
        if (this.validateForm() === false) {
          return;
        }
        this.collectData();
        $.ajax({
            type: "POST",
            url: _this.form.attr('action'),
            data: _this.dataForm, // данные для отправки на сервер
            contentType: false,
            processData: false,
            cache: false,
            beforeSend: function () {
                _this.form.find('.progress').removeClass('d-none');
                _this.changeStateSubmit(true);
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
                            _this.form.find('.progress-bar')
                                .attr('aria-valuenow', progress)
                                .width(progress + '%')
                                .find('span')
                                    .text(progress + '%');
                        }
                    }, false);
                }
                return myXhr;
            },
            success: function (data) {
                _this.form
                    .find('.progress').addClass('d-none').end()
                    .find('.attachments-error').parent().addClass('d-none');
                data = JSON.parse(data);
                // если сервер вернул ответ success, то значит двнные отправлены
                if (data.result === "success") {
                    document.getElementById(_this.id_form).reset();
                    _this.form.find('input,textarea').each(function () {
                        _this.changeStateInput(this, 'clear');
                    });
                    if (_this.existenceUploadsFile) {
                        _this.form.find('.attachments').html(_this.attachments_code);
                    }
                    if (_this.existenceCaptcha) {
                        _this.refreshCaptcha();
                    }
                    if (_this.hideForm) {
                        _this.form.hide();
                        _this.form.parent().find('.form-success').removeClass('d-none');
                    }
                } else {
                    _this.form
                        .find('.progress-bar').css('width', '0%').end()
                        .find('.form-error').removeClass('d-none').end()
                        .find('.attachments-error').parent().addClass('d-none');
                    _this.changeStateSubmit(false);
                    // сбрасываем состояние всех input и textarea элементов
                    _this.form.find('input,textarea').not('[type="file"]').each(function () {
                        _this.changeStateInput(this, 'clear');
                    });
                    // отображаем ошибки
                    for (var error in data) {
                        if (data.hasOwnProperty(error)) {
                            if (error === 'captcha') { // кроме той, которая имеет ключ result
                                var captcha = _this.form.find('[name="captcha"]').eq(0);
                                $(captcha).val('');
                                var imgCaptcha = _this.form.find('.img-captcha');
                                var src = imgCaptcha.attr('data-src');
                                if (src.indexOf('?id') !== -1) {
                                    src += '&rnd='+(new Date()).getTime();
                                } else {
                                    src += '?rnd='+(new Date()).getTime();
                                }
                                imgCaptcha.attr('src',src);
                                _this.changeStateInput(_this.form.find('[name="' + error + '"]')[0], 'error', data[error]);
                            } else if (error !== 'attachment' && error !== 'log') {
                                _this.changeStateInput(_this.form.find('[name="' + error + '"]')[0], 'error', data[error]);
                            } else if (error === 'attachment') { // ошибки, связанные с прикреплёнными файлами
                                var attachments = '<ul class="mb-0 pl-3">';
                                data[error].forEach(function (attachment, i, error) {
                                    attachments += '<li>' + attachment + '</li>';
                                });
                                attachments += '</ul>';
                                _this.form.find('.attachments-error')
                                    .html(attachments)
                                    .parent()
                                        .removeClass('d-none');
                            } else if (error === 'log') { // выводим все сообщения с ключом log в консоль браузера
                                data[error].forEach(function (log, i, error) {
                                    console.log(log);
                                });
                            }
                        }
                    }
                    if (_this.form.find('.is-invalid').length > 0) {
                        _this.form.find('.is-invalid')[0].focus();
                    }
                }
            },
            error: function (request) {
                _this.form
                    .find('.progress-bar').css('width', '0%').end()
                    .find('.form-error').removeClass('d-none');
            }
        });
    };
    // обновление капчи
    ProcessForm.prototype.refreshCaptcha = function () {
        var captcha = this.form.find('.img-captcha');
        var src_captcha = captcha.attr('data-src');
        if (src_captcha.indexOf('?id') !== -1) {
            src_captcha += '&rnd='+(new Date()).getTime();
        } else {
            src_captcha += '?rnd='+(new Date()).getTime();
        }
        captcha.attr('src',src_captcha);
    };
    // изменение элемента input с type="file"
    ProcessForm.prototype.changeInputFile = function (e) {
        // условие для добавления нового блока custom-file
        var is_selected = e.currentTarget.files.length > 0;
        var is_added = $(e.currentTarget).closest('.custom-file').next('.custom-file').length === 0;
        var is_max_count = this.form.find('input[name="attachment[]"]').length < this.countFiles;
        if (is_selected && is_added && is_max_count) {
            $(e.currentTarget).closest('.custom-file').after(this.custom_file);
        }
        // валидация файла
        if (e.currentTarget.files.length > 0) {
            // получим файл
            var file = e.currentTarget.files[0];
            $(e.currentTarget).next('.custom-file-label').addClass("selected").text(file.name);
            // проверим размер и расширение файла
            if (file.size > this.maxSizeFile) {
                $(e.currentTarget).removeClass('is-valid').addClass('is-invalid');
                $(e.currentTarget).closest('.custom-file').find('.invalid-feedback').text('Файл не будет отправлен, т.к. его размер больше ' + this.maxSizeFile / 1024 + 'Кбайт');
            } else if (!this.validateFileExtension(file.name)) {
                $(e.currentTarget).removeClass('is-valid').addClass('is-invalid');
                $(e.currentTarget).closest('.custom-file').find('.invalid-feedback').text('Файл не будет отправлен, т.к. его тип не соответствует разрешённому.');
            } else {
                $(e.currentTarget).removeClass('is-invalid').addClass('is-valid');
            }
        } else {
            // если после изменения файл не выбран, то сообщаем об этом пользователю
            $(e.currentTarget).next('.custom-file-label').addClass("selected").text('');
            $(e.currentTarget).removeClass('is-valid').addClass('is-invalid');
            $(e.currentTarget).closest('.custom-file').find('.invalid-feedback').text('Файл не будет отправлен, т.к. он не выбран');
        }
    };

    /*
     Параметры указываются в виде:
     {
     ключ: значение;
     ключ: значение;
     ...
     }
     id_form - id формы обратной связи (по умолчанию feedbackForm)
     existenceUploadsFile - наличие у формы блока загрузки файлов (по умолчанию true)
     countFiles - количество файлов для загрузки (по умолчанию 5)
     maxSizeFile - максиальный размер файла в байтах (по умолчанию 524288 байт)
     validFileExtensions - допустимые расширения файлов (по умолчанию 'jpg','jpeg','bmp','gif','png')
     existenceCaptcha - наличие у формы капчи (по умолчанию true)
     hideForm - скрыть форму после отправки данных
     agreeCheckbox - флажок о принятии пользовательского соглашения перед отправкой формы (по умолчанию true)

     */
    var formFeedback = new ProcessForm({id_form: 'feedbackForm', maxSizeFile: 524288});
    formFeedback.init();

    //var contactForm = new ProcessForm({ id_form: 'contactForm', existenceUploadsFile: false, existenceCaptcha: false });
    //contactForm.init();

});