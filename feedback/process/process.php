<?php

/*
 * Форма обратной связи (https://itchief.ru/lessons/php/feedback-form-for-website)
 * Copyright 2016-2020 Alexander Maltsev
 * Licensed under MIT (https://github.com/itchief/feedback-form/blob/master/LICENSE)
 */

header('Content-Type: application/json');

// обработка только ajax запросов (при других запросах завершаем выполнение скрипта)
if (empty($_SERVER['HTTP_X_REQUESTED_WITH']) || $_SERVER['HTTP_X_REQUESTED_WITH'] != 'XMLHttpRequest') {
  exit();
}
// обработка данных, посланных только методом POST (при остальных методах завершаем выполнение скрипта)
if ($_SERVER['REQUEST_METHOD'] != 'POST') {
  exit();
}

const
MAX_FILE_SIZE = 524288, // максимальный размер файла 512Кбайт (512*1024=524288)
MAIL_FROM = 'alex@yandex.ru', // от какого email будет отправляться письмо
MAIL_FROM_NAME = 'Имя_сайта', // от какого имени будет отправляться письмо
MAIL_SUBJECT = 'Сообщение с формы обратной связи', // тема письма
MAIL_ADDRESS = 'manager@mydomain.ru', // кому необходимо отправить письмо
MAIL_SUBJECT_CLIENT = 'Ваше сообщение доставлено', // настройки mail для информирования пользователя о доставке сообщения
IS_SENDING_MAIL_VIA_SMTP = true, // выполнять отправку писем через SMTP
// Если IS_SENDING_MAIL_VIA_SMTP установлен равным true
MAIL_SMTP_HOST = 'ssl://smtp.yandex.ru', // SMTP-хост
MAIL_SMTP_PORT = '465', // SMTP-порт
MAIL_SMTP_USERNAME = 'alex@yandex.ru', // здесь нужно указать email пользователя с которого будет отправлять письмо (SMTP-пользователь)
MAIL_SMTP_PASSWORD = 'пароль_от_почты_alex@yandex.ru'; // здесь нужно указать пароль от почты (SMTP-пароль)

// стартовый путь ('http://mydomain.ru/')
$startPath = 'http' . (isset($_SERVER['HTTPS']) ? 's' : '') . '://' . $_SERVER['HTTP_HOST'] . '/';
// директория для хранения загруженных файлов
$uploadPath = dirname(dirname(__FILE__)) . '/uploads/';
// разрешённые расширения файлов
$allowedExtensions = array('gif', 'jpg', 'png');

// PHPMailer
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

require_once('../phpmailer/src/Exception.php');
require_once('../phpmailer/src/PHPMailer.php');
require_once('../phpmailer/src/SMTP.php');

// открываем сессию
session_start();
// переменная, хранящая основной статус обработки формы
$data['result'] = 'success';

/* 1 ЭТАП - ВАЛИДАЦИЯ ДАННЫХ (ЗНАЧЕНИЙ ПОЛЕЙ ФОРМЫ) */
// name
if (isset($_POST['name'])) {
  $name = filter_var($_POST['name'], FILTER_SANITIZE_STRING); // защита от XSS
  $nameLength = mb_strlen($name, 'UTF-8');
  if ($nameLength < 2) {
    $data['name'] = 'Текст должен быть не короче 2 симв. Длина текста сейчас: ' . $nameLength . ' симв.';
    $data['result'] = 'error';
  } else if ($nameLength > 30) {
    $data['name'] = 'Длина текста не должна превышать 30 симв. (сейчас ' . $nameLength . ' симв.).';
    $data['result'] = 'error';
  }
} else {
  $data['name'] = 'Заполните это поле.';
  $data['result'] = 'error';
}
// email
if (isset($_POST['email'])) {
  if (!filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) { // защита от XSS
    $data['email'] = 'Адрес электронной почты не корректный';
    $data['result'] = 'error';
  } else {
    $email = $_POST['email'];
  }
} else {
  $data['email'] = 'Заполните это поле.';
  $data['result'] = 'error';
}
// message
if (isset($_POST['message'])) {
  $message = filter_var($_POST['message'], FILTER_SANITIZE_STRING); // защита от XSS
  $messageLength = mb_strlen($message, 'UTF-8');
  if ($messageLength < 20) {
    $data['message'] = 'Текст должен быть не короче 20 симв. Длина текста сейчас: ' . $messageLength . ' симв.';
    $data['result'] = 'error';
  } else if ($messageLength > 500) {
    $data['message'] = 'Длина текста не должна превышать 500 симв. (сейчас ' . $messageLength . ' симв.)';
    $data['result'] = 'error';
  }
} else {
  $data['message'] = 'Заполните это поле.';
  $data['result'] = 'error';
}
// капчи
if (isset($_POST['captcha']) && isset($_SESSION['captcha'])) {
  $captcha = filter_var($_POST['captcha'], FILTER_SANITIZE_STRING); // защита от XSS
  if ($_SESSION['captcha'] != $captcha) { // проверка капчи
    $data['captcha'] = 'Код не соответствует изображению.';
    $data['result'] = 'error';
  }
} else {
  $data['captcha'] = 'Ошибка при проверке кода';
  $data['result'] = 'error';
}
// файлы (валидация и перемещение в папку Uploads)
if (isset($_FILES['attachment'])) {
  // перебор массива $_FILES['attachment']
  foreach ($_FILES['attachment']['error'] as $key => $error) {
    // если файл был успешно загружен на сервер (ошибок не возникло), то...
    if ($error == UPLOAD_ERR_OK) {
      // получаем имя файла
      $fileName = $_FILES['attachment']['name'][$key];
      // получаем расширение файла в нижнем регистре
      $fileExtension = mb_strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
      // получаем размер файла
      $fileSize = $_FILES['attachment']['size'][$key];
      // результат проверки расширения файла
      $resultCheckExtension = true;
      // проверяем расширение загруженного файла
      if (!in_array($fileExtension, $allowedExtensions)) {
        $resultCheckExtension = false;
        $data['attachment'][$fileName] = 'Файл ' . $fileName . ' имеет не допустимое разрешение';
        $data['result'] = 'error';
      }
      // проверяем размер файла
      if ($resultCheckExtension && ($fileSize > MAX_FILE_SIZE)) {
        $data['attachment'][$fileName] = 'Файл ' . $fileName . ' имеет не допустимый размер (более 512 Кбайт)';
        $data['result'] = 'error';
      }
    }
  }
  // если ошибок валидации не возникло, то...
  if ($data['result'] == 'success') {
    // переменная для хранения имён файлов
    $attachments = array();
    // перемещение файлов в директорию UPLOAD_PATH
    foreach ($_FILES['attachment']['name'] as $key => $attachment) {
      // получаем имя файла
      $fileName = basename($_FILES['attachment']['name'][$key]);
      // получаем расширение файла в нижнем регистре
      $fileExtension = mb_strtolower(pathinfo($fileName, PATHINFO_EXTENSION));
      // временное имя файла на сервере
      $fileTmp = $_FILES['attachment']['tmp_name'][$key];
      // создаём уникальное имя
      $fileNewName = uniqid('upload_', true) . '.' . $fileExtension;
      // перемещаем файл в директорию
      if (!move_uploaded_file($fileTmp, $uploadPath . $fileNewName)) {
        // ошибка при перемещении файла
        $data['attachment'][] = 'Ошибка при загрузке файла ' . $fileName;
        $data['result'] = 'error';
      } else {
        $attachments[] = $uploadPath . $fileNewName;
      }
    }
  }
}

// отправка формы (данных на почту)
if ($data['result'] == 'success') {

  //формируем тело письма
  $bodyMail = file_get_contents('email.tpl'); // получаем содержимое email шаблона

  // добавление файлов в виде ссылок
  if (isset($attachments)) {
    $listFiles = '<ul>';
    foreach ($attachments as $attachment) {
      $fileHref = substr($attachment, strpos($attachment, 'feedback/uploads/'));
      $fileName = basename($fileHref);
      $listFiles .= '<li><a href="' . $startPath . $fileHref . '">' . $fileName . '</a></li>';
    }
    $listFiles .= '</ul>';
    $bodyMail = str_replace('%email.attachments%', $listFiles, $bodyMail);
  } else {
    $bodyMail = str_replace('%email.attachments%', '-', $bodyMail);
  }

  // выполняем замену плейсхолдеров реальными значениями
  $bodyMail = str_replace('%email.title%', MAIL_SUBJECT, $bodyMail);
  $bodyMail = str_replace('%email.nameuser%', isset($name) ? $name : '-', $bodyMail);
  $bodyMail = str_replace('%email.message%', isset($message) ? $message : '-', $bodyMail);
  $bodyMail = str_replace('%email.emailuser%', isset($email) ? $email : '-', $bodyMail);
  $bodyMail = str_replace('%email.date%', date('d.m.Y H:i'), $bodyMail);

  // отправляем письмо с помощью PHPMailer
  $mail = new PHPMailer;
  $mail->CharSet = 'UTF-8';

  /* Отправка письма по SMTP */
  if (IS_SENDING_MAIL_VIA_SMTP === true) {
    $mail->isSMTP();
    $mail->SMTPAuth = true;
    $mail->Host = MAIL_SMTP_HOST;
    $mail->Port = MAIL_SMTP_PORT;
    $mail->Username = MAIL_SMTP_USERNAME;
    $mail->Password = MAIL_SMTP_PASSWORD;
  }

  $mail->Encoding = 'base64';
  $mail->IsHTML(true);
  $mail->setFrom(MAIL_FROM, MAIL_FROM_NAME);
  $mail->Subject = MAIL_SUBJECT;
  $mail->Body = $bodyMail;

  $mail->addAddress(MAIL_ADDRESS);

  // прикрепление файлов к письму
  if (isset($attachments)) {
    foreach ($attachments as $attachment) {
      $mail->addAttachment($attachment);
    }
  }

  // отправляем письмо
  if (!$mail->send()) {
    $data['result'] = 'error';
  }

  // информируем пользователя по email о доставке
  if (isset($email)) {
    // очистка всех адресов и прикреплёных файлов
    $mail->clearAllRecipients();
    $mail->clearAttachments();
    //формируем тело письма
    $bodyMail = file_get_contents('email_client.tpl'); // получаем содержимое email шаблона
    // выполняем замену плейсхолдеров реальными значениями
    $bodyMail = str_replace('%email.title%', MAIL_SUBJECT, $bodyMail);
    $bodyMail = str_replace('%email.nameuser%', isset($name) ? $name : '-', $bodyMail);
    $bodyMail = str_replace('%email.date%', date('d.m.Y H:i'), $bodyMail);
    $mail->Subject = MAIL_SUBJECT_CLIENT;
    $mail->Body = $bodyMail;
    $mail->addAddress($email);
    if (!$mail->send()) {
      $data['result'] = 'error';
    }
  }
}

// отправка данных формы в файл
if ($data['result'] == 'success') {
  $name = isset($name) ? $name : '-';
  $email = isset($email) ? $email : '-';
  $message = isset($message) ? $message : '-';
  $output = "---------------------------------" . "\n";
  $output .= date("d-m-Y H:i:s") . "\n";
  $output .= "Имя пользователя: " . $name . "\n";
  $output .= "Адрес email: " . $email . "\n";
  $output .= "Сообщение: " . $message . "\n";
  if (isset($attachments)) {
    $output .= "Файлы: " . "\n";
    foreach ($attachments as $attachment) {
      $output .= $attachment . "\n";
    }
  }
  if (!file_put_contents(dirname(dirname(__FILE__)) . '/info/message.txt', $output, FILE_APPEND | LOCK_EX)) {
    $data['result'] = 'error';
  }
}

// сообщаем результат клиенту
echo json_encode($data);