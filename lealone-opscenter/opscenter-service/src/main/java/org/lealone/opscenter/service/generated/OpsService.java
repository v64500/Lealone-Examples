package org.lealone.opscenter.service.generated;

import java.sql.*;
import org.lealone.client.ClientServiceProxy;

/**
 * Service interface for 'ops_service'.
 *
 * THIS IS A GENERATED OBJECT, DO NOT MODIFY THIS CLASS.
 */
public interface OpsService {

    static OpsService create(String url) {
        if (new org.lealone.db.ConnectionInfo(url).isEmbedded())
            return new org.lealone.opscenter.service.OpsServiceImpl();
        else
            return new ServiceProxy(url);
    }

    String getLanguageCombo();

    String readTranslations(String language);

    String login(String url, String user, String password);

    static class ServiceProxy implements OpsService {

        private final PreparedStatement ps1;
        private final PreparedStatement ps2;
        private final PreparedStatement ps3;

        private ServiceProxy(String url) {
            ps1 = ClientServiceProxy.prepareStatement(url, "EXECUTE SERVICE OPS_SERVICE GET_LANGUAGE_COMBO()");
            ps2 = ClientServiceProxy.prepareStatement(url, "EXECUTE SERVICE OPS_SERVICE READ_TRANSLATIONS(?)");
            ps3 = ClientServiceProxy.prepareStatement(url, "EXECUTE SERVICE OPS_SERVICE LOGIN(?, ?, ?)");
        }

        @Override
        public String getLanguageCombo() {
            try {
                ResultSet rs = ps1.executeQuery();
                rs.next();
                String ret =  rs.getString(1);
                rs.close();
                return ret;
            } catch (Throwable e) {
                throw ClientServiceProxy.failed("OPS_SERVICE.GET_LANGUAGE_COMBO", e);
            }
        }

        @Override
        public String readTranslations(String language) {
            try {
                ps2.setString(1, language);
                ResultSet rs = ps2.executeQuery();
                rs.next();
                String ret =  rs.getString(1);
                rs.close();
                return ret;
            } catch (Throwable e) {
                throw ClientServiceProxy.failed("OPS_SERVICE.READ_TRANSLATIONS", e);
            }
        }

        @Override
        public String login(String url, String user, String password) {
            try {
                ps3.setString(1, url);
                ps3.setString(2, user);
                ps3.setString(3, password);
                ResultSet rs = ps3.executeQuery();
                rs.next();
                String ret =  rs.getString(1);
                rs.close();
                return ret;
            } catch (Throwable e) {
                throw ClientServiceProxy.failed("OPS_SERVICE.LOGIN", e);
            }
        }
    }
}
