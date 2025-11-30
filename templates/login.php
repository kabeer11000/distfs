<?php include 'layouts/header.php'; ?>

<h1>Login</h1>
<form method="POST" action="index.php?page=login">
    <div style="margin-bottom: 10px;">
        <label>Email:</label><br>
        <input type="email" name="email" required>
    </div>
    <div style="margin-bottom: 10px;">
        <label>Password:</label><br>
        <input type="password" name="password" required>
    </div>
    <button type="submit">Log In</button>
</form>

<?php include 'layouts/footer.php'; ?>
