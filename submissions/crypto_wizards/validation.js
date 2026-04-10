const formEl = document.getElementById('form');
const fnameEl = document.getElementById('fname');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const errorMsgEl = document.getElementById('errorMsg');
let errors=[];

formEl.addEventListener('submit',(e)=>{
    errors=[];
    if(fnameEl=== null){
        //signin
        signInFormValidation(emailEl.value,passwordEl.value);
        if(errors.length>0){
            e.preventDefault();
            errorMsgEl.innerHTML=errors.join('<br>');
            return;
        }

        const email=emailEl.value;
        const encryptedpassword=btoa(passwordEl.value);

        if(!localStorage.getItem(email)){
            errorMsgEl.innerText="User doesn't exist";
            e.preventDefault();
            formEl.reset();
            return;
        }
        user=JSON.parse(localStorage.getItem(email));
        e.preventDefault();
        if(user.encryptedpassword===encryptedpassword){
            localStorage.setItem('currentUser',JSON.stringify(user));
            window.location.href='index.html';
        }
        else{
            e.preventDefault();
            errorMsgEl.innerText='Wrong Password';
            passwordEl.parentElement.classList.add('incorrect');
            // passwordEl.reset();
            passwordEl.value='';
            return;
        }

    }
    else{
        //signup
        signUpFormValidation(fnameEl.value,emailEl.value,passwordEl.value);
        if(errors.length>0){
            e.preventDefault();
            errorMsgEl.innerHTML=errors.join('<br>');
            return;
        }

        const fname=fnameEl.value;
        const email=emailEl.value;
        const encryptedpassword=btoa(passwordEl.value);

        
        if(localStorage.getItem(email)){
            alert('User already exists.Please Login');
            return;
        }
        const user ={
            fname:fname,
            email:email,
            encryptedpassword:encryptedpassword,
            prefrences:[],
            recent:[]
        }
        localStorage.setItem(email,JSON.stringify(user));
        alert('Signup Successful.You can now login.');
        // formEl.reset();
    }
})
const inputEls = [fnameEl, emailEl, passwordEl].filter((el) => el !== null);
inputEls.forEach((el)=>{
    el.addEventListener('input',()=>{
        if(el.parentElement.classList.contains('incorrect')){
            el.parentElement.classList.remove('incorrect');
        }
    })
})

const regex =/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/ ;
function signUpFormValidation(name,email,password){
    if(name===''){
        errors.push('Please enter a name.');
        fnameEl.parentElement.classList.add('incorrect');
    }
    if(email===''){
        errors.push('Please enter a email.');
        emailEl.parentElement.classList.add('incorrect');
    }
    else if(!regex.test(email)){
        errors.push('Please enter a valid email.');
        emailEl.parentElement.classList.add('incorrect');
    }
    if(password.length===0){
        errors.push('Please enter password');
        passwordEl.parentElement.classList.add('incorrect');
    }
    else if(password.length<8){
        errors.push('Password should be less than 8 characters.');
        passwordEl.parentElement.classList.add('incorrect');
    }
}
function signInFormValidation(email,password){
    if(email===''){
        errors.push('Please enter a email.');
        emailEl.parentElement.classList.add('incorrect');
    }
    else if(!regex.test(email)){
        errors.push('Please enter a valid email.');
        emailEl.parentElement.classList.add('incorrect');
    }
    if(password.length===0){
        errors.push('Please enter password');
        passwordEl.parentElement.classList.add('incorrect');
    }
    else if(password.length<8){
        errors.push('Password should be less than 8 characters.');
        passwordEl.parentElement.classList.add('incorrect');
    }
}