<?php
class FileModel {
    public static function getAllFilesForUser(string $user_id)  {
        return [
            ['name' => 'Report.pdf', 'size' => '2MB'],
            ['name' => 'Photo.jpg', 'size' => '5MB'],
            ['name' => 'Backup.zip', 'size' => '1GB']
        ];
    }
}
class DashboardController {
    public function index() {
        // 1. Get Data (from your Models/DB)
        $files = FileModel::getAllFilesForUser($_SESSION['user_id']);
        $storageUsed = '1024 MB';

        // 2. Render Template with Data
        echo view('dashboard', [
            'pageTitle' => 'My Files',
            'files' => $files,
            'usage' => $storageUsed
        ]);
    }
}
