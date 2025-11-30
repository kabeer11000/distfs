<?php
// src/Controllers/AuthController.php

class AuthController {
    public function login() {
        echo view('login', ['message' => 'Please enter your credentials']);
    }
}
