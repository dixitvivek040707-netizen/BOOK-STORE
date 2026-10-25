// validate.js : JavaScript validation for the registration form
function showError(id, message) { document.getElementById(id).textContent = message; }
function validateName() {
 var name = document.getElementById("name").value.trim();
 if (name === "") { showError("nameErr", "Name is required."); return false; }
 if (!/^[A-Za-z ]+$/.test(name)) { showError("nameErr", "Name must contain alphabets only."); return false; }
 if (name.length < 6) { showError("nameErr", "Name must be at least 6 characters long."); return false; }
 showError("nameErr", ""); return true;
}
function validatePassword() {
 var pwd = document.getElementById("password").value;
 if (pwd.length < 6) { showError("passwordErr", "Password must be at least 6 characters long."); return false; }
 showError("passwordErr", ""); return true;
}
function validateEmail() {
 var email = document.getElementById("email").value.trim();
 var pattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
 if (!pattern.test(email)) { showError("emailErr", "Enter a valid e-mail such as name@domain.com."); return false; }
 showError("emailErr", ""); return true;
}
function validatePhone() {
 var phone = document.getElementById("phone").value.trim();
 if (!/^[0-9]{10}$/.test(phone)) { showError("phoneErr", "Phone number must contain exactly 10 digits."); return false; }
 showError("phoneErr", ""); return true;
}
function validateForm() {
 var okName = validateName(), okPwd = validatePassword(), okEmail = validateEmail(), okPhone = validatePhone();
 document.getElementById("result").textContent =
  (okName && okPwd && okEmail && okPhone) ? "Registration successful." : "";
 return false;
}
function clearMessages() {
 var ids = ["nameErr", "passwordErr", "emailErr", "phoneErr", "result"];
 for (var i = 0; i < ids.length; i++) document.getElementById(ids[i]).textContent = "";
}
function fillDob() {
 var day = document.getElementById("day"), month = document.getElementById("month"), year = document.getElementById("year");
 var names = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
 for (var d = 1; d <= 31; d++) day.options.add(new Option(d, d));
 for (var m = 0; m < names.length; m++) month.options.add(new Option(names[m], m + 1));
 for (var y = 2010; y >= 1960; y--) year.options.add(new Option(y, y));
}
window.onload = fillDob;
