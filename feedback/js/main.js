//после загрузки веб-страницы
$(function () {
  var form1 = feedbackForm();
  form1.init({
    id: '#feedbackForm',
    isHideForm: true,
    maxFiles: 3, // количество элементов input 
    maxFileSize: 524288, // maxSizeFile
    validExtFiles: ['jpg', 'jpeg', 'gif', 'png'] // допустимые ра
  });

});